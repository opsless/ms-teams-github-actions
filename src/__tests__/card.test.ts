import {buildWebhookBody, CardData} from '../card'

const baseData: CardData = {
  repository: {
    name: 'opsless/ms-teams-github-actions',
    html_url: 'https://github.com/org/repo'
  },
  commit: {
    message: 'fix: baseline commit message',
    html_url: 'https://github.com/org/repo/commit/deadbeef'
  },
  workflow: {
    name: 'CI',
    conclusion: 'SUCCEEDED',
    conclusion_color: 'good',
    run_number: 42,
    run_html_url: 'https://github.com/org/repo/actions/runs/42'
  },
  event: {
    type: 'Branch',
    html_url: 'https://github.com/org/repo/tree/main'
  },
  author: {
    username: 'tester',
    html_url: 'https://github.com/tester',
    avatar_url: 'https://github.com/tester.png'
  }
}

function commitFactValue(body: unknown): string {
  const attachment = (
    body as {
      attachments: {content: {body: {facts?: {value: string}[]}[]}}[]
    }
  ).attachments[0]
  const factSet = attachment.content.body.find(b => b.facts !== undefined)
  if (!factSet || !factSet.facts) {
    throw new Error('FactSet not found in card')
  }
  return factSet.facts[0].value
}

function workflowTitleText(body: unknown): string {
  const text = (
    body as {
      attachments: {content: {body: {text: string}[]}}[]
    }
  ).attachments[0].content.body[0].text
  return text
}

describe('buildWebhookBody', () => {
  describe('payload envelope', () => {
    it('wraps the card in the Teams message envelope', () => {
      const body = buildWebhookBody(baseData)
      expect(body.type).toBe('message')
      expect(body.attachments).toHaveLength(1)
      expect(body.attachments[0].contentType).toBe(
        'application/vnd.microsoft.card.adaptive'
      )
    })

    it('returns the card content as a plain object, not a JSON string', () => {
      const body = buildWebhookBody(baseData)
      expect(typeof body.attachments[0].content).toBe('object')
      expect(body.attachments[0].content).not.toBeInstanceOf(String)
    })

    it('builds an Adaptive Card v1.4', () => {
      const content = bodyContent(buildWebhookBody(baseData))
      expect(content.type).toBe('AdaptiveCard')
      expect(content.version).toBe('1.4')
    })
  })

  // Regression coverage for the JSON injection bug fixed in PR #121.
  // The original code did `JSON.stringify(template) -> expand -> JSON.parse`,
  // which corrupted the JSON whenever a value contained a `"` or `\`. These
  // tests pin the contract that the webhook body is always serialisable.
  describe('JSON safety with commit messages containing special characters', () => {
    const cases: {name: string; message: string}[] = [
      {
        name: 'double quotes (original bug)',
        message: 'build: fix "quoted" task'
      },
      {name: 'backslashes', message: 'fix: path\\with\\backslashes'},
      {name: 'trailing backslash', message: 'fix: trailing backslash \\'},
      {
        name: 'forward and backslashes mixed',
        message: 'fix: forward/slash and back\\slash'
      },
      {name: 'tab character', message: 'chore: tabbed\tmessage'},
      {name: 'carriage return', message: 'chore: carriage\rreturn'},
      {
        name: 'newline (first line kept by caller)',
        message: 'feat: subject\nbody'
      },
      {name: 'single quotes', message: "feat: 'single' quotes"},
      {name: 'square and angle brackets', message: 'fix: <script> [BRACKET]'},
      {name: 'emoji', message: 'feat: ship it 🚀'},
      {name: 'non-ASCII (CJK)', message: 'feat: 日本語 中文 한국어'},
      {name: 'JSON-like braces', message: 'fix: {"json": "looking"} thing'},
      {
        name: 'literal template expression',
        message: 'fix: ${1+1} not evaluated'
      },
      {
        name: 'JSONata-style binding',
        message: 'fix: ${$root.commit.message} not evaluated'
      },
      {name: 'plain ASCII baseline', message: 'fix: nothing fancy here'}
    ]

    cases.forEach(({name, message}) => {
      it(`produces JSON-roundtrippable body when commit message has ${name}`, () => {
        const body = buildWebhookBody({
          ...baseData,
          commit: {...baseData.commit, message}
        })

        const serialised = JSON.stringify(body)
        expect(() => JSON.parse(serialised)).not.toThrow()

        const parsed = JSON.parse(serialised)
        const firstLine = message.split('\n')[0]
        expect(commitFactValue(parsed)).toContain(firstLine)
      })
    })

    it('produces JSON-roundtrippable body when commit message is empty', () => {
      const body = buildWebhookBody({
        ...baseData,
        commit: {...baseData.commit, message: ''}
      })

      const serialised = JSON.stringify(body)
      expect(() => JSON.parse(serialised)).not.toThrow()
    })

    it('does NOT evaluate ${...} expressions in the commit message', () => {
      const body = buildWebhookBody({
        ...baseData,
        commit: {
          ...baseData.commit,
          message: 'test: ${1+1} should not become 2'
        }
      })
      const serialised = JSON.stringify(body)
      expect(serialised).toContain('${1+1}')
      expect(serialised).toContain('${1+1} should not become 2')
      expect(serialised).not.toContain('"test: 2 should not become 2"')
    })

    it('embeds the commit message inside the Commit fact markdown link', () => {
      const body = buildWebhookBody({
        ...baseData,
        commit: {
          ...baseData.commit,
          message: 'build: fix "quoted" task'
        }
      })
      expect(commitFactValue(body)).toBe(
        '[build: fix "quoted" task](https://github.com/org/repo/commit/deadbeef)'
      )
    })
  })

  describe('JSON safety with workflow.name containing special characters', () => {
    const names = [
      'My "quoted" workflow',
      'workflow\\with\\backslash',
      'CI/CD <production>',
      '日本語 CI'
    ]

    names.forEach(name => {
      it(`produces JSON-roundtrippable body for workflow name: ${JSON.stringify(name)}`, () => {
        const body = buildWebhookBody({
          ...baseData,
          workflow: {...baseData.workflow, name}
        })
        const serialised = JSON.stringify(body)
        expect(() => JSON.parse(serialised)).not.toThrow()
        expect(workflowTitleText(JSON.parse(serialised))).toContain(name)
      })
    })
  })

  describe('JSON safety with repository.name containing special characters', () => {
    const names = ['org/"quoted"/repo', 'fork\\slash', '組織/リポジトリ']

    names.forEach(name => {
      it(`produces JSON-roundtrippable body for repository name: ${JSON.stringify(name)}`, () => {
        const body = buildWebhookBody({
          ...baseData,
          repository: {...baseData.repository, name}
        })
        const serialised = JSON.stringify(body)
        expect(() => JSON.parse(serialised)).not.toThrow()
      })
    })
  })
})

function bodyContent(body: unknown): {type: string; version: string} {
  return (body as {attachments: {content: {type: string; version: string}}[]})
    .attachments[0].content
}
