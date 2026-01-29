import type { AgentTeam } from '../../agent_team/agent_team.js';
import { AgentTeamStatus } from '../../agent_team/status/agent_team_status.js';
import {
  AgentEventRebroadcastPayload,
  AgentTeamStatusUpdateData,
  SubTeamEventRebroadcastPayload,
  type AgentTeamStreamEvent
} from '../../agent_team/streaming/agent_team_stream_events.js';
import { StreamEventType } from '../../agent/streaming/events/stream_events.js';
import { ToolInvocationApprovalRequestedData } from '../../agent/streaming/events/stream_event_payloads.js';
import type { StreamEvent } from '../../agent/streaming/stream_events.js';
import type { Task } from '../../task_management/task.js';
import { TaskStatus } from '../../task_management/base_task_plan.js';
import {
  TasksCreatedEventSchema,
  TaskStatusUpdatedEventSchema,
  type TasksCreatedEvent,
  type TaskStatusUpdatedEvent
} from '../../task_management/events.js';

const isAgentEventPayload = (data: unknown): data is AgentEventRebroadcastPayload => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const candidate = data as Record<string, any>;
  return 'agent_name' in candidate && 'agent_event' in candidate;
};

const isSubTeamEventPayload = (data: unknown): data is SubTeamEventRebroadcastPayload => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const candidate = data as Record<string, any>;
  return 'sub_team_node_name' in candidate && 'sub_team_event' in candidate;
};

const isTeamStatusPayload = (data: unknown): data is AgentTeamStatusUpdateData => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  return 'new_status' in (data as Record<string, any>);
};

export type NodeData = {
  type: 'team' | 'subteam' | 'agent';
  name: string;
  role?: string | null;
  children: Record<string, NodeData>;
};

export type UiHistoryEvent =
  | { event_type: 'ui_user_message'; data: { content: string } }
  | { event_type: 'ui_tool_decision'; data: { content: string } };

export type HistoryEvent = StreamEvent | UiHistoryEvent;

type AgentTeamLike = {
  name: string;
  role?: string | null;
  _runtime?: {
    context?: {
      config?: {
        nodes?: Array<{ node_definition?: { role?: string | null; name?: string } }>;
      };
    };
  };
};

export class TuiStateStore {
  team_name: string;
  team_role: string | null;
  focused_node_data: NodeData | null = null;
  version = 0;

  _node_roles: Record<string, string>;
  _nodes: Record<string, NodeData>;
  _agent_statuses: Record<string, any> = {};
  _team_statuses: Record<string, AgentTeamStatus>;
  _agent_event_history: Record<string, HistoryEvent[]> = {};
  _team_event_history: Record<string, AgentTeamStreamEvent[]> = {};
  _pending_approvals: Record<string, ToolInvocationApprovalRequestedData> = {};
  _speaking_agents: Record<string, boolean> = {};
  _task_plans: Record<string, Task[]> = {};
  _task_statuses: Record<string, Record<string, TaskStatus>> = {};
  private _dirty = false;

  constructor(team: AgentTeam) {
    const teamLike = team as unknown as AgentTeamLike;
    this.team_name = teamLike.name;
    this.team_role = teamLike.role ?? null;

    this._node_roles = this.extract_node_roles(teamLike);
    this._nodes = this.initialize_root_node();
    this._team_statuses = { [this.team_name]: AgentTeamStatus.UNINITIALIZED };
    this._team_event_history = { [this.team_name]: [] };
  }

  process_event(event: AgentTeamStreamEvent): void {
    this.version += 1;
    this._dirty = true;

    if (event.event_source_type === 'TEAM' && isTeamStatusPayload(event.data)) {
      this._team_statuses[this.team_name] = event.data.new_status as AgentTeamStatus;
    }

    this.process_event_recursively(event, this.team_name);
  }

  get_tree_data(): Record<string, NodeData> {
    return JSON.parse(JSON.stringify(this._nodes)) as Record<string, NodeData>;
  }

  get_history_for_node(node_name: string, node_type: string): HistoryEvent[] {
    if (node_type === 'agent') {
      return this._agent_event_history[node_name] ?? [];
    }
    return [];
  }

  get_pending_approval_for_agent(agent_name: string): ToolInvocationApprovalRequestedData | null {
    return this._pending_approvals[agent_name] ?? null;
  }

  get_task_plan_tasks(team_name: string): Task[] | null {
    return this._task_plans[team_name] ?? null;
  }

  get_task_plan_statuses(team_name: string): Record<string, TaskStatus> | null {
    return this._task_statuses[team_name] ?? null;
  }

  clear_pending_approval(agent_name: string): void {
    delete this._pending_approvals[agent_name];
  }

  append_user_message(agent_name: string, content: string): void {
    if (!content.trim()) {
      return;
    }
    if (!this._agent_event_history[agent_name]) {
      this._agent_event_history[agent_name] = [];
      if (!this.find_node(agent_name)) {
        const agent_role = this._node_roles[agent_name] ?? 'Agent';
        this.add_node(agent_name, { type: 'agent', name: agent_name, role: agent_role, children: {} }, this.team_name);
      }
    }
    this._agent_event_history[agent_name].push({
      event_type: 'ui_user_message',
      data: { content }
    });
    this.version += 1;
    this._dirty = true;
  }

  get_last_user_message(agent_name: string): string | null {
    const history = this._agent_event_history[agent_name];
    if (!history || history.length === 0) {
      return null;
    }
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const event = history[i] as HistoryEvent;
      if (event.event_type === 'ui_user_message') {
        return (event as UiHistoryEvent).data.content ?? null;
      }
    }
    return null;
  }

  append_tool_decision(agent_name: string, content: string): void {
    if (!content.trim()) {
      return;
    }
    if (!this._agent_event_history[agent_name]) {
      this._agent_event_history[agent_name] = [];
      if (!this.find_node(agent_name)) {
        const agent_role = this._node_roles[agent_name] ?? 'Agent';
        this.add_node(agent_name, { type: 'agent', name: agent_name, role: agent_role, children: {} }, this.team_name);
      }
    }
    this._agent_event_history[agent_name].push({
      event_type: 'ui_tool_decision',
      data: { content }
    });
    this.version += 1;
    this._dirty = true;
  }

  consume_dirty(): boolean {
    const dirty = this._dirty;
    this._dirty = false;
    return dirty;
  }

  mark_dirty(): void {
    this._dirty = true;
  }

  set_focused_node(node_data: NodeData | null): void {
    this.focused_node_data = node_data;
  }

  private extract_node_roles(team: AgentTeamLike): Record<string, string> {
    const roles: Record<string, string> = {};
    const nodes = team._runtime?.context?.config?.nodes ?? [];
    for (const nodeConfig of nodes) {
      const role = nodeConfig?.node_definition?.role;
      const name = nodeConfig?.node_definition?.name;
      if (role && name) {
        roles[name] = role;
      }
    }
    return roles;
  }

  private initialize_root_node(): Record<string, NodeData> {
    return {
      [this.team_name]: {
        type: 'team',
        name: this.team_name,
        role: this.team_role,
        children: {}
      }
    };
  }

  private process_event_recursively(event: AgentTeamStreamEvent, parent_name: string): void {
    if (!this._team_event_history[parent_name]) {
      this._team_event_history[parent_name] = [];
    }
    this._team_event_history[parent_name].push(event);

    if (event.event_source_type === 'TASK_PLAN') {
      this.process_task_plan_event(event.data, parent_name);
      return;
    }

    if (isAgentEventPayload(event.data)) {
      const agent_name = String((event.data as any).agent_name ?? '');
      const agent_event = (event.data as any).agent_event as StreamEvent;

      if (!this._agent_event_history[agent_name]) {
        this._agent_event_history[agent_name] = [];
        const agent_role = this._node_roles[agent_name] ?? 'Agent';
        this.add_node(agent_name, { type: 'agent', name: agent_name, role: agent_role, children: {} }, parent_name);
      }

      this._agent_event_history[agent_name].push(agent_event);

      if (agent_event.event_type === StreamEventType.AGENT_STATUS_UPDATED) {
        const data = agent_event.data as { new_status?: any };
        if (data?.new_status) {
          this._agent_statuses[agent_name] = data.new_status;
          delete this._pending_approvals[agent_name];
        }
      } else if (agent_event.event_type === StreamEventType.ASSISTANT_CHUNK) {
        this._speaking_agents[agent_name] = true;
      } else if (agent_event.event_type === StreamEventType.ASSISTANT_COMPLETE_RESPONSE) {
        this._speaking_agents[agent_name] = false;
      } else if (agent_event.event_type === StreamEventType.TOOL_INVOCATION_APPROVAL_REQUESTED) {
        this._pending_approvals[agent_name] = agent_event.data as ToolInvocationApprovalRequestedData;
      }
      return;
    }

    if (isSubTeamEventPayload(event.data)) {
      const sub_team_name = String((event.data as any).sub_team_node_name ?? '');
      const sub_team_event = (event.data as any).sub_team_event as AgentTeamStreamEvent | undefined;
      if (!this.find_node(sub_team_name)) {
        const role = this._node_roles[sub_team_name] ?? 'Sub-Team';
        this.add_node(sub_team_name, { type: 'subteam', name: sub_team_name, role, children: {} }, parent_name);
      }

      if (sub_team_event?.event_source_type === 'TEAM' && isTeamStatusPayload(sub_team_event.data)) {
        this._team_statuses[sub_team_name] = sub_team_event.data.new_status;
      }

      if (sub_team_event) {
        this.process_event_recursively(sub_team_event, sub_team_name);
      }
    }
  }

  private process_task_plan_event(eventData: unknown, team_name: string): void {
    const created = TasksCreatedEventSchema.safeParse(eventData);
    if (created.success) {
      const data = created.data as TasksCreatedEvent;
      if (!this._task_plans[team_name]) {
        this._task_plans[team_name] = [];
      }
      if (!this._task_statuses[team_name]) {
        this._task_statuses[team_name] = {};
      }
      this._task_plans[team_name].push(...data.tasks);
      for (const task of data.tasks) {
        this._task_statuses[team_name][task.task_id] = TaskStatus.NOT_STARTED;
      }
      return;
    }

    const updated = TaskStatusUpdatedEventSchema.safeParse(eventData);
    if (updated.success) {
      const data = updated.data as TaskStatusUpdatedEvent;
      if (!this._task_statuses[team_name]) {
        this._task_statuses[team_name] = {};
      }
      this._task_statuses[team_name][data.task_id] = data.new_status;

      if (data.deliverables && this._task_plans[team_name]) {
        for (const task of this._task_plans[team_name]) {
          if (task.task_id === data.task_id) {
            task.file_deliverables = data.deliverables;
            break;
          }
        }
      }
    }
  }

  private add_node(node_name: string, node_data: NodeData, parent_name: string): void {
    const parent = this.find_node(parent_name);
    if (parent) {
      parent.children[node_name] = node_data;
    } else {
      console.error(`Could not find parent node '${parent_name}' to add child '${node_name}'.`);
    }
  }

  private find_node(node_name: string, tree?: Record<string, NodeData>): NodeData | undefined {
    const treeData = tree ?? this._nodes;
    for (const [name, node_data] of Object.entries(treeData)) {
      if (name === node_name) {
        return node_data;
      }
      if (Object.keys(node_data.children).length) {
        const found = this.find_node(node_name, node_data.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }
}
