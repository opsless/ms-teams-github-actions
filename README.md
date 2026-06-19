# MS Team Github Actions integration

### Usage

> [!WARNING]
> Microsoft has [retired the legacy Office 365 connectors / incoming webhooks](https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/). URLs that look like `https://*.webhook.office.com/...` or `https://outlook.office.com/webhook/...` are no longer delivered. A Workflows-based webhook (below) is required.

1. Create a **Workflows-based incoming webhook** in Microsoft Teams and add it as the `MS_TEAMS_WEBHOOK_URI` secret in your repository's **Settings → Secrets and variables → Actions**. See [Create webhooks using Workflows](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=dotnet#create-webhooks-using-workflows) in the Microsoft Learn docs for instructions.

2. Add a new `step` on your workflow code as last step of workflow job:

```yaml
name: MS Teams Github Actions integration

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v7
      # ... your build / test / deploy steps go here ...
      - uses: opsless/ms-teams-github-actions@main
        if: always() # to let this step always run even if previous step failed
        with:
          github-token: ${{ github.token }}
          webhook-uri: ${{ secrets.MS_TEAMS_WEBHOOK_URI }}
```

### Known Issues

- Always set this step with `if: always()` when there are steps between `actions/checkout` and this step.

### Roadmap

- add error message if workflow failed
- add files changed list
- add workflow run duration

Feel free to create issue if you have an idea in mind
