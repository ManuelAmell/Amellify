import { Socket } from 'node:net'
import { connect as tlsConnect, TLSSocket } from 'node:tls'

/**
 * Minimal dependency-free SMTP client used only for Better Auth's
 * password-reset / email-verification emails (plan: "solo si SMTP_HOST
 * está seteada"). No mail library (e.g. nodemailer) is in package.json,
 * and Agent A was told not to add dependencies — this hand-rolled client
 * covers the common self-hosted case (STARTTLS on 587, implicit TLS on
 * 465, AUTH LOGIN) but is best-effort, not a full RFC 5321 client. If
 * broader provider compatibility is needed later, swap this out for
 * `nodemailer` (see final report).
 */

export interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? '587'),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM || `Amellify <no-reply@${host}>`,
  }
}

export const isEmailConfigured = (): boolean => getSmtpConfig() !== null

interface SendEmailInput {
  to: string
  subject: string
  text: string
  html: string
}

/** Reads SMTP reply line(s) for a given command, resolving once the reply is complete (no more "-" continuation). */
function readReply(socket: Socket | TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split('\r\n').filter(Boolean)
      const last = lines[lines.length - 1]
      // Multi-line replies use "250-..." for all but the last line ("250 ...").
      if (last && /^\d{3}(?:[ ].*)?$/.test(last)) {
        cleanup()
        resolve(buffer)
      }
    }
    const onError = (err: Error) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
    }
    socket.on('data', onData)
    socket.on('error', onError)
  })
}

function send(socket: Socket | TLSSocket, command: string): Promise<string> {
  const reply = readReply(socket)
  socket.write(`${command}\r\n`)
  return reply
}

function assertOk(reply: string, context: string) {
  const code = Number(reply.slice(0, 3))
  if (code < 200 || code >= 400) {
    throw new Error(`SMTP error during ${context}: ${reply.trim()}`)
  }
}

function encodeHeader(value: string): string {
  // Best-effort MIME encoded-word for non-ASCII subjects/names.
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/**
 * Sends a single plaintext+HTML email over SMTP. Resolves silently if SMTP
 * is not configured (callers should check `isEmailConfigured()` before
 * relying on delivery, but this is safe to call unconditionally too).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const config = getSmtpConfig()
  if (!config) {
    console.warn(`[mailer] SMTP not configured — skipping email to ${input.to}: ${input.subject}`)
    return
  }

  const useImplicitTls = config.port === 465
  let socket: Socket | TLSSocket = useImplicitTls
    ? tlsConnect({ host: config.host, port: config.port, servername: config.host })
    : new Socket()

  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject)
    if (useImplicitTls) {
      socket.once('secureConnect', () => resolve())
    } else {
      ;(socket as Socket).connect(config.port, config.host, () => resolve())
    }
  })

  try {
    await readReply(socket) // server greeting (220)
    let ehloReply = await send(socket, `EHLO amellify.local`)
    assertOk(ehloReply, 'EHLO')

    if (!useImplicitTls && /STARTTLS/i.test(ehloReply)) {
      const startTlsReply = await send(socket, 'STARTTLS')
      assertOk(startTlsReply, 'STARTTLS')
      const plainSocket = socket as Socket
      socket = await new Promise<TLSSocket>((resolve, reject) => {
        const upgraded = tlsConnect({ socket: plainSocket, servername: config.host }, () =>
          resolve(upgraded)
        )
        upgraded.once('error', reject)
      })
      ehloReply = await send(socket, `EHLO amellify.local`)
      assertOk(ehloReply, 'EHLO (TLS)')
    }

    if (config.user) {
      assertOk(await send(socket, 'AUTH LOGIN'), 'AUTH LOGIN')
      assertOk(await send(socket, Buffer.from(config.user, 'utf8').toString('base64')), 'AUTH LOGIN (user)')
      assertOk(
        await send(socket, Buffer.from(config.password, 'utf8').toString('base64')),
        'AUTH LOGIN (password)'
      )
    }

    const fromAddress = config.from.match(/<(.+)>/)?.[1] ?? config.from
    assertOk(await send(socket, `MAIL FROM:<${fromAddress}>`), 'MAIL FROM')
    assertOk(await send(socket, `RCPT TO:<${input.to}>`), 'RCPT TO')
    assertOk(await send(socket, 'DATA'), 'DATA')

    const boundary = `amellify-${Date.now()}`
    const message = [
      `From: ${config.from}`,
      `To: ${input.to}`,
      `Subject: ${encodeHeader(input.subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      '',
      input.text,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      '',
      input.html,
      '',
      `--${boundary}--`,
      '.',
    ]
      // RFC 5321 dot-stuffing: escape lines starting with "." (other than the terminator above).
      .map((line, i, arr) => (i < arr.length - 1 && line.startsWith('.') ? `.${line}` : line))
      .join('\r\n')

    assertOk(await send(socket, message), 'message body')
    await send(socket, 'QUIT').catch(() => undefined)
  } finally {
    socket.end()
  }
}
