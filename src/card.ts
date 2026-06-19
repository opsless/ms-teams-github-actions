import {Template} from 'adaptivecards-templating'

const templateData = {
  type: 'AdaptiveCard',
  body: [
    {
      type: 'TextBlock',
      size: 'large',
      weight: 'bolder',
      text: "Workflow '${$root.workflow.name}' #${$root.workflow.run_number} ${$root.workflow.conclusion}",
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
  version: '1.4'
}

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
  attachments: Array<{
    contentType: string
    // adaptivecards-templating expands to a plain object; we keep it opaque so
    // callers can `JSON.stringify` without us making assumptions about the shape.
    content: unknown
  }>
}

// Pass the template as an object: stringifying it first would cause raw
// textual substitution inside a JSON string and produce invalid JSON when
// a value (e.g. a commit message) contains a `"` or `\`.
export function buildWebhookBody(data: CardData): WebhookBody {
  const template = new Template(templateData)
  const content = template.expand({$root: data})
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content
      }
    ]
  }
}
