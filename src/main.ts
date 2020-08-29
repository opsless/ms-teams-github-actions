import * as core from "@actions/core";
import * as github from "@actions/github";
import * as axios from "axios"

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}   

async function run() {
  try {
    const token = core.getInput("github-token");
    const webhookUri = core.getInput("webhook-uri")
    const ctx = github.context;
    const o = github.getOctokit(token);

    await sleep(5000)

    const jobList = await o.actions.listJobsForWorkflowRun({
      repo: ctx.repo.repo,
      owner: ctx.repo.owner,
      run_id: ctx.runId,
    });
    
    const jobs = jobList.data.jobs
    const job = jobs.find(job => job.name === ctx.job);

    const stoppedStep = job?.steps.find(s => s.conclusion === "failure" || s.conclusion === "timed_out" || s.conclusion === "cancelled" || s.conclusion === "action_required")
    const lastStep = stoppedStep ? stoppedStep : job?.steps.reverse().find(s => s.status === "completed")

    core.info(JSON.stringify(jobList))

    const wr = await o.actions.getWorkflowRun({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      run_id: ctx.runId
    })

    const repository_url = ctx.payload.repository?.html_url
    const commit_author = ctx.actor

    var themeColor = lastStep?.conclusion === "success" ? "90C978": "C23B23"
    const conclusion = lastStep?.conclusion === "success" ? "SUCCEEDED" : "FAILED"
    
    const webhookBody = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": `${themeColor}`,
      "summary": `${commit_author} commited new changes`,
      "sections": [
        {
          "activityTitle": `Workflow '${ctx.workflow}' #${ctx.runNumber} ${conclusion}`,
          "activitySubtitle": `on [${ctx.payload.repository?.full_name}](${repository_url})`,
          "facts": [
            {
              name: "Commit",
              value: `[${wr.data.head_commit.message}](${wr.data.repository.html_url}/commit/${wr.data.head_sha}) by [${ctx.payload.sender?.login}](${ctx.payload.sender?.html_url})`
            },
            {
              name: ctx.eventName === "pull_request" ? "Pull request" : "Branch",
              value: ctx.eventName === "pull_request" ? `[${ctx.payload.pull_request?.html_url}](${ctx.payload.pull_request?.html_url})` : `${ctx.payload.repository?.html_url}/tree/${ctx.ref}`
            },
            {
              name: "Workflow run details",
              value: `[${wr.data.html_url}](${wr.data.html_url})`
            }
          ],
          "markdown": true
        }
      ]
    }
    const response = await axios.default.post(webhookUri, webhookBody)
    // TODO: check response status, if not succesful, mark workflow as failed
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
