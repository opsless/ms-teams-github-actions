# MS Team Github Actions integration

### Usage

1. Add `MS_TEAMS_WEBHOOK_URI` on your repository's configs on Settings >
   Secrets. It is the
   [webhook URI](https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)
   of the dedicated Microsoft Teams channel for notification.

2) Add a new `step` on your workflow code as last step of workflow job:

```yaml
name: MS Teams Github Actions integration

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: opsless/ms-teams-github-actions@main
        if: always() # to let this step always run even if previous step failed
        with:
          github-token: ${{ github.token }}
          webhook-uri: ${{ secrets.MS_TEAMS_WEBHOOK_URI }}
```

### Known Issues

- Always set this step with `if: always()` when there are steps between
  `actions/checkout@v2` and this step.

### Roadmap

- add error message if workflow failed
- add files changed list
- add workflow run duration

Feel free to create issue if you have an idea in mind
