import * as core from '@actions/core'
import * as github from '@actions/github'
import * as axios from 'axios'

async function sleep(ms: number): Promise<unknown> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

enum Conclusions {
  SUCCESS = "success",
  FAILURE = "failure",
  NEUTRAL = "neutral",
  CANCELLED = "cancelled",
  SKIPPED = "skipped",
  TIMED_OUT = "timed_out",
  ACTION_REQUIRED = "action_required"
}

enum StepStatus {
  QUEUED = "queued",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed"
}

async function run(): Promise<unknown> {
  try {
    const token = core.getInput('github-token')
    if (!token) {
      core.setFailed("'github-token' input can't be empty")
      return
    }

    const webhookUri = core.getInput('webhook-uri')
    if (!webhookUri) {
      core.setFailed("'webhook-uri' input can't be empty")
      return
    }
    const ctx = github.context
    const o = github.getOctokit(token)

    core.debug(JSON.stringify(ctx))

    await sleep(5000)

    const jobList = await o.actions.listJobsForWorkflowRun({
      repo: ctx.repo.repo,
      owner: ctx.repo.owner,
      run_id: ctx.runId
    })

    const jobs = jobList.data.jobs
    core.debug(JSON.stringify(jobs))

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

    core.debug(JSON.stringify(wr.data))

    const repository_url = ctx.payload.repository?.html_url
    const commit_author = ctx.actor

    const themeColor =
      lastStep?.conclusion === Conclusions.SUCCESS
        ? '90C978'
        : lastStep?.conclusion === Conclusions.CANCELLED
        ? 'FFF175'
        : 'C23B23'
    const conclusion =
      lastStep?.conclusion === Conclusions.SUCCESS
        ? 'SUCCEEDED'
        : lastStep?.conclusion === Conclusions.CANCELLED
        ? 'CANCELLED'
        : 'FAILED'

    const webhookBody = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: `${themeColor}`,
      summary: `${commit_author} commited new changes`,
      sections: [
        {
          activityTitle: `Workflow '${ctx.workflow}' #${ctx.runNumber} ${conclusion}`,
          activitySubtitle: `on [${ctx.payload.repository?.full_name}](${repository_url})`,
          facts: [
            {
              name: 'Commit',
              value: `[${wr.data.head_commit.message}](${wr.data.repository.html_url}/commit/${wr.data.head_sha}) by [${ctx.payload.sender?.login}](${ctx.payload.sender?.html_url})`
            },
            {
              name:
                ctx.eventName === 'pull_request' ? 'Pull request' : 'Branch',
              value:
                ctx.eventName === 'pull_request'
                  ? `[${ctx.payload.pull_request?.html_url}](${ctx.payload.pull_request?.html_url})`
                  : `[${ctx.payload.repository?.html_url}/tree/${ctx.ref}](${ctx.payload.repository?.html_url}/tree/${ctx.ref})`
            },
            {
              name: 'Workflow run details',
              value: `[${wr.data.html_url}](${wr.data.html_url})`
            }
          ],
          markdown: true
        }
      ]
    }
    const response = await axios.default.post(webhookUri, webhookBody)
    core.debug(JSON.stringify(response.data))
    // TODO: check response status, if not succesful, mark workflow as failed
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
