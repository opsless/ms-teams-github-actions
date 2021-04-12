import * as core from '@actions/core'
import * as github from '@actions/github'
import * as axios from 'axios'
import {Template} from 'adaptivecards-templating'

const temlpateData = {
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      size: 'large',
      weight: 'bolder',
      text:
        "Workflow '${$root.workflow.name}' #${$root.workflow.run_number} ${$root.workflow.conclusion}",
      color: '${$root.workflow.conclusion_color}',
      fontType: 'Default',
      separator: true
    },
    {
      type: 'TextBlock',
      text: 'on [${$root.repository.name}](${$root.repository.html_url})',
      wrap: true,
      spacing: 'None'
    },
    {
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column',
          items: [
            {
              type: 'Image',
              style: 'Person',
              url: '${$root.author.avatar_url}',
              size: 'Medium'
            }
          ],
          width: 'auto'
        },
        {
          type: 'Column',
          items: [
            {
              type: 'TextBlock',
              weight: 'Bolder',
              text: '[${$root.author.username}](${$root.author.html_url})',
              wrap: true
            }
          ],
          width: 'stretch'
        }
      ],
      spacing: 'Medium'
    },
    {
      type: 'FactSet',
      facts: [
        {
          title: 'Commit',
          value: '[${$root.commit.message}](${$root.commit.html_url})'
        },
        {
          title: '${$root.event.type}',
          value: '[${$root.event.html_url}](${$root.event.html_url})'
        },
        {
          title: 'Workflow run details',
          value:
            '[${$root.workflow.run_html_url}](${$root.workflow.run_html_url})'
        }
      ],
      height: 'stretch',
      separator: true,
      spacing: 'Medium'
    }
  ],
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.2'
}

async function sleep(ms: number): Promise<unknown> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

enum Conclusions {
  SUCCESS = 'success',
  FAILURE = 'failure',
  NEUTRAL = 'neutral',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
  TIMED_OUT = 'timed_out',
  ACTION_REQUIRED = 'action_required'
}

enum StepStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

enum TextBlockColor {
  Good = 'good',
  Attention = 'attention',
  Warning = 'warning'
}

const send = async () => {
  await sleep(5000)
  const token = core.getInput('github-token')
  const webhookUri = core.getInput('webhook-uri')
  const o = github.getOctokit(token)
  const ctx = github.context
  const jobList = await o.actions.listJobsForWorkflowRun({
    repo: ctx.repo.repo,
    owner: ctx.repo.owner,
    run_id: ctx.runId
  })

  const jobs = jobList.data.jobs

  const job = jobs.find(j => j.name.startsWith(ctx.job))

  const stoppedStep = job?.steps.find(
    s =>
      s.conclusion === Conclusions.FAILURE ||
      s.conclusion === Conclusions.TIMED_OUT ||
      s.conclusion === Conclusions.TIMED_OUT ||
      s.conclusion === Conclusions.ACTION_REQUIRED
  )
  const lastStep = stoppedStep
    ? stoppedStep
    : job?.steps.reverse().find(s => s.status === StepStatus.COMPLETED)

  const wr = await o.actions.getWorkflowRun({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    run_id: ctx.runId
  })

  core.info(wr.data.head_commit.message)

  const conclusion =
    lastStep?.conclusion === Conclusions.SUCCESS
      ? 'SUCCEEDED'
      : lastStep?.conclusion === Conclusions.CANCELLED
      ? 'CANCELLED'
      : 'FAILED'

  const conclusion_color =
    lastStep?.conclusion === Conclusions.SUCCESS
      ? TextBlockColor.Good
      : lastStep?.conclusion === Conclusions.CANCELLED
      ? TextBlockColor.Warning
      : TextBlockColor.Attention

  const rawdata = JSON.stringify(temlpateData)
  const template = new Template(rawdata)
  const content = template.expand({
    $root: {
      repository: {
        name: ctx.payload.repository?.full_name,
        html_url: ctx.payload.repository?.html_url
      },
      commit: {
        message: wr.data.head_commit.message,
        html_url: `${wr.data.repository.html_url}/commit/${wr.data.head_sha}`
      },
      workflow: {
        name: ctx.workflow,
        conclusion,
        conclusion_color,
        run_number: ctx.runNumber,
        run_html_url: wr.data.html_url
      },
      event: {
        type: ctx.eventName === 'pull_request' ? 'Pull request' : 'Branch',
        html_url:
          ctx.eventName === 'pull_request'
            ? ctx.payload.pull_request?.html_url
            : `${ctx.payload.repository?.html_url}/tree/${ctx.ref}`
      },
      author: {
        username: ctx.payload.sender?.login,
        html_url: ctx.payload.sender?.html_url,
        avatar_url: ctx.payload.sender?.avatar_url
      }
    }
  })

  const webhookBody = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: JSON.parse(content)
      }
    ]
  }

  core.info(JSON.stringify(webhookBody))

  const response = await axios.default.post(webhookUri, webhookBody)
  core.info(JSON.stringify(response.data))
}

async function run() {
  try {
    await send()
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

run()
