import * as core from '@actions/core'
import {readFileSync} from 'node:fs'
import {buildWebhookBody, CardData} from './card.js'

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

function getRepository(): {owner: string; repo: string} {
  const parts = (process.env.GITHUB_REPOSITORY || '').split('/')
  return {owner: parts[0] ?? '', repo: parts[1] ?? ''}
}

function getEventPayload(): Record<string, unknown> {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) return {}
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return {}
  }
}

const send = async () => {
  await sleep(5000)
  const token = core.getInput('github-token')
  const webhookUri = core.getInput('webhook-uri')
  if (!webhookUri) {
    throw new Error('Missing MS Teams webhook URI')
  }

  const {owner, repo} = getRepository()
  const runId = process.env.GITHUB_RUN_ID
  const payload = getEventPayload()
  const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com'

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  const jobsResponse = await fetch(
    `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
    {headers: apiHeaders}
  )
  if (!jobsResponse.ok) {
    const errorText = await jobsResponse.text()
    throw new Error(
      `GitHub API listJobsForWorkflowRun failed with status ${jobsResponse.status}: ${errorText}`
    )
  }
  const jobsData = (await jobsResponse.json()) as {
    jobs: {
      name: string
      steps?: {conclusion?: string; status?: string}[]
    }[]
  }

  const jobs = jobsData.jobs
  const jobName = process.env.GITHUB_JOB || ''
  const job = jobs.find(j => j.name.startsWith(jobName))

  const stoppedStep = job?.steps?.find(
    s =>
      s.conclusion === Conclusions.FAILURE ||
      s.conclusion === Conclusions.TIMED_OUT ||
      s.conclusion === Conclusions.ACTION_REQUIRED
  )
  const lastStep = stoppedStep
    ? stoppedStep
    : job?.steps?.reverse().find(s => s.status === StepStatus.COMPLETED)

  const wrResponse = await fetch(
    `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}`,
    {headers: apiHeaders}
  )
  if (!wrResponse.ok) {
    const errorText = await wrResponse.text()
    throw new Error(
      `GitHub API getWorkflowRun failed with status ${wrResponse.status}: ${errorText}`
    )
  }
  const wrData = (await wrResponse.json()) as {
    head_commit?: {message?: string}
    repository: {html_url: string}
    head_sha: string
    html_url: string
  }

  const full_commit_message = wrData?.head_commit?.message || ''
  const commit_message = full_commit_message.split('\n')[0]

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

  const repositoryPayload = payload.repository as
    | {full_name?: string; html_url?: string}
    | undefined
  const senderPayload = payload.sender as
    | {login?: string; html_url?: string; avatar_url?: string}
    | undefined
  const pullRequestPayload = payload.pull_request as
    | {html_url?: string}
    | undefined
  const eventName = process.env.GITHUB_EVENT_NAME || ''

  const cardData: CardData = {
    repository: {
      name: repositoryPayload?.full_name,
      html_url: repositoryPayload?.html_url
    },
    commit: {
      message: commit_message,
      html_url: `${wrData.repository.html_url}/commit/${wrData.head_sha}`
    },
    workflow: {
      name: process.env.GITHUB_WORKFLOW || '',
      conclusion,
      conclusion_color,
      run_number: Number(process.env.GITHUB_RUN_NUMBER || 0),
      run_html_url: wrData.html_url
    },
    event: {
      type: eventName === 'pull_request' ? 'Pull request' : 'Branch',
      html_url:
        eventName === 'pull_request'
          ? pullRequestPayload?.html_url
          : `${repositoryPayload?.html_url}/tree/${process.env.GITHUB_REF || ''}`
    },
    author: {
      username: senderPayload?.login,
      html_url: senderPayload?.html_url,
      avatar_url: senderPayload?.avatar_url
    }
  }

  const webhookBody = buildWebhookBody(cardData)

  core.info(JSON.stringify(webhookBody))

  const timeout = 30000
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await fetch(webhookUri, {
    method: 'POST',
    body: JSON.stringify(webhookBody),
    headers: {'Content-Type': 'application/json'},
    signal: controller.signal
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `MS Teams webhook request failed with status ${response.status}: ${errorText}`
    )
  }

  let responseData
  const responseText = await response.text()
  if (responseText) {
    try {
      responseData = JSON.parse(responseText)
    } catch {
      core.warning(`Failed to parse response as JSON: ${responseText}`)
      responseData = {text: responseText}
    }
  } else {
    responseData = {message: 'Empty response received'}
  }

  clearTimeout(id)
  core.info(JSON.stringify(responseData))
}

async function run() {
  try {
    await send()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.error(message)
    core.setFailed(message)
  }
}

run()
