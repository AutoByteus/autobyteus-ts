import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AgentConfig } from '../../../src/agent/context/agent_config.js';
import { BaseAgentWorkspace } from '../../../src/agent/workspace/base_workspace.js';
import { WorkspaceConfig } from '../../../src/agent/workspace/workspace_config.js';
import { AgentTeamBuilder } from '../../../src/agent_team/agent_team_builder.js';
import { run_agent_team_cli } from '../../../src/cli/index.js';
import { SendMessageTo } from '../../../src/agent/message/send_message_to.js';
import { CreateTasks } from '../../../src/task_management/tools/task_tools/create_tasks.js';
import { GetTaskPlanStatus } from '../../../src/task_management/tools/task_tools/get_task_plan_status.js';
import { UpdateTaskStatus } from '../../../src/task_management/tools/task_tools/update_task_status.js';
import { registerWriteFileTool } from '../../../src/tools/file/write_file.js';
import { registerReadFileTool } from '../../../src/tools/file/read_file.js';
import { registerRunBashTool } from '../../../src/tools/terminal/tools/run_bash.js';
import { loadEnv, resolveExamplePath } from '../../shared/example_paths.js';
import { createLlmOrThrow, printAvailableModels } from '../../shared/llm_helpers.js';
import { setConsoleLogLevel } from '../../shared/logging.js';

class SimpleWorkspace extends BaseAgentWorkspace {
  private rootPath: string;

  constructor(rootPath: string) {
    super(new WorkspaceConfig({ root_path: rootPath }));
    this.rootPath = rootPath;
  }

  get_base_path(): string {
    return this.rootPath;
  }

  getBasePath(): string {
    return this.rootPath;
  }
}

async function loadPrompt(filename: string): Promise<string> {
  const promptPath = resolveExamplePath(
    'agent_team',
    'event_driven',
    'prompts',
    'software_engineering',
    filename
  );
  return fs.readFile(promptPath, 'utf8');
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'llm-model': { type: 'string', default: 'qwen/qwen3-next-80b:lmstudio@192.168.2.158:1234' },
      'coordinator-model': { type: 'string' },
      'engineer-model': { type: 'string' },
      'reviewer-model': { type: 'string' },
      'tester-model': { type: 'string' },
      'output-dir': { type: 'string', default: './code_review_output' },
      'help-models': { type: 'boolean', default: false }
    }
  });

  loadEnv();
  setConsoleLogLevel(
    process.env.AUTOBYTEUS_LOG_LEVEL ?? 'info',
    process.env.AUTOBYTEUS_LOG_FILE ?? './logs/agent_team_software_engineering_event.log'
  );

  if (!process.env.AUTOBYTEUS_TASK_NOTIFICATION_MODE) {
    process.env.AUTOBYTEUS_TASK_NOTIFICATION_MODE = 'system_event_driven';
  }

  if (values['help-models']) {
    console.log('Available LLM Models (use the Identifier with --llm-model):');
    await printAvailableModels();
    return;
  }

  const coordinatorModel = values['coordinator-model'] ?? values['llm-model'];
  const engineerModel = values['engineer-model'] ?? values['llm-model'];
  const reviewerModel = values['reviewer-model'] ?? values['llm-model'];
  const testerModel = values['tester-model'] ?? values['llm-model'];

  const outputDir = path.resolve(values['output-dir']);
  await fs.mkdir(outputDir, { recursive: true });
  const workspace = new SimpleWorkspace(outputDir);

  const coordinatorLlm = await createLlmOrThrow(coordinatorModel);
  const engineerLlm = await createLlmOrThrow(engineerModel);
  const reviewerLlm = await createLlmOrThrow(reviewerModel);
  const testerLlm = await createLlmOrThrow(testerModel);

  const coordinatorConfig = new AgentConfig(
    'Project Manager',
    'Coordinator',
    'Manages the development process by planning tasks.',
    coordinatorLlm,
    await loadPrompt('coordinator.prompt'),
    [new CreateTasks(), new GetTaskPlanStatus()]
  );

  const engineerConfig = new AgentConfig(
    'Software Engineer',
    'Developer',
    'Writes code and corresponding tests based on instructions.',
    engineerLlm,
    await loadPrompt('software_engineer.prompt'),
    [registerWriteFileTool(), new UpdateTaskStatus(), new GetTaskPlanStatus()],
    true,
    null,
    null,
    null,
    null,
    null,
    workspace
  );

  const reviewerConfig = new AgentConfig(
    'Code Reviewer',
    'Senior Developer',
    'Reviews code and tests for quality and correctness.',
    reviewerLlm,
    await loadPrompt('code_reviewer.prompt'),
    [registerReadFileTool(), registerWriteFileTool(), new UpdateTaskStatus(), new GetTaskPlanStatus()],
    true,
    null,
    null,
    null,
    null,
    null,
    workspace
  );

  const testerConfig = new AgentConfig(
    'Tester',
    'QA Automation',
    'Executes tests and reports results.',
    testerLlm,
    await loadPrompt('tester.prompt'),
    [registerRunBashTool(), new UpdateTaskStatus(), new GetTaskPlanStatus(), new SendMessageTo()],
    true,
    null,
    null,
    null,
    null,
    null,
    workspace
  );

  const team = new AgentTeamBuilder('SoftwareDevTeam', 'Event-driven software team.')
    .set_coordinator(coordinatorConfig)
    .add_agent_node(engineerConfig)
    .add_agent_node(reviewerConfig)
    .add_agent_node(testerConfig)
    .build();

  try {
    await run_agent_team_cli(team);
  } finally {
    await coordinatorLlm.cleanup();
    await engineerLlm.cleanup();
    await reviewerLlm.cleanup();
    await testerLlm.cleanup();
  }
}

void main();
