export interface CardData {
  repository: {
    name: string | undefined
    html_url: string | undefined
  }
  commit: {
    message: string
    html_url: string
  }
  workflow: {
    name: string
    conclusion: string
    conclusion_color: string
    run_number: number
    run_html_url: string | undefined
  }
  event: {
    type: string
    html_url: string | undefined
  }
  author: {
    username: string | undefined
    html_url: string | undefined
    avatar_url: string | undefined
  }
}

export interface WebhookBody {
  type: 'message'
  attachments: {
    contentType: string
    content: unknown
  }[]
}

function buildCard(data: CardData) {
  const s = (v: unknown) => (v === undefined || v === null ? '' : v)

  return {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'large',
        weight: 'bolder',
        text: `Workflow '${s(data.workflow.name)}' #${s(data.workflow.run_number)} ${s(data.workflow.conclusion)}`,
        color: s(data.workflow.conclusion_color),
        fontType: 'Default',
        separator: true
      },
      {
        type: 'TextBlock',
        text: `on [${s(data.repository.name)}](${s(data.repository.html_url)})`,
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
                url: s(data.author.avatar_url),
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
                text: `[${s(data.author.username)}](${s(data.author.html_url)})`,
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
            value: `[${s(data.commit.message)}](${s(data.commit.html_url)})`
          },
          {
            title: s(data.event.type),
            value: `[${s(data.event.html_url)}](${s(data.event.html_url)})`
          },
          {
            title: 'Workflow run details',
            value: `[${s(data.workflow.run_html_url)}](${s(data.workflow.run_html_url)})`
          }
        ],
        height: 'stretch',
        separator: true,
        spacing: 'Medium'
      }
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4'
  }
}

export function buildWebhookBody(data: CardData): WebhookBody {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: buildCard(data)
      }
    ]
  }
}
