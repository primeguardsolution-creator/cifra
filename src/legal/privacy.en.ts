import { Doc, contactLine, operator } from './company';

const o = operator('en');

export const privacyEn: Doc = {
  title: 'Privacy Policy',
  intro: [
    `This Privacy Policy explains what personal data ${o.full} (“CIFRA”, “we”) processes when you use CIFRA, what we use it for, who we share it with, how long we keep it and what rights you have. It applies to the installable web app (PWA), the mobile apps and all features of the service, in the Personal space and the Business space.`,
    'In a few lines: we use your phone number and name to create your account; we store your messages and files to deliver and show them to you; we do not sell your data or use it for advertising; we do not read your chats except what is reported to us or what the law requires; you can delete your account and everything of yours from within the app.',
  ],
  sections: [
    { h: '1. Who is the controller', p: [
      `The controller of your account data and of your use of the service is ${o.full}.`,
      `You can contact us about any privacy matter through ${contactLine('en')}.`,
      'In the Business space there are two different roles: for your user-account data, CIFRA is the controller; for the customer data a Business manages (conversations, CRM records, appointments, tags, notes), the Business is the controller and CIFRA acts as the processor that hosts and processes it on the Business’s instructions (see section 12).',
    ] },
    { h: '2. What data we process', p: [
      'Account and profile data:',
      '• Phone number (your identifier), display name, optional username (@), optional bio, optional profile photo and cover, language, time zone and privacy settings (for example, whether people can find you by number or whether your phone is hidden).',
      '• Your password, which we never store in clear: only an encrypted hash managed by the authentication provider.',
      '• Recovery e-mail and its verification status, and the recovery code, of which we keep only an encrypted fingerprint (hash), never the code itself.',
      'Content you create:',
      '• Text messages, photos, videos, voice notes, documents and other files, replies, reactions, starred messages, scheduled messages, polls and votes, statuses and posts, and calls (their existence, duration and status; we do not record their content).',
      '• In Business: business data (name, description, contact details, hours, logo, catalogue, posts), team and roles, customer records (name, phone, e-mail, stage, tags, notes, value), appointments, tasks, quick replies, greetings and automatic messages, and broadcasts sent.',
      'Usage and technical data:',
      '• Message delivery and read states, time sent, who takes part in each conversation, contacts you add and people you block, reports you send or receive.',
      '• Device and connection data: browser and system type, app version, IP address, technical identifiers and error logs needed for security and operation.',
      '• If you turn notifications on: a subscription identifier (endpoint and keys) of your device, which we use only to send you alerts, and your alert preferences per space.',
      'Third-party data you give us:',
      '• If you add a person as a contact or customer, or write to someone, we process the data you enter about them (name, phone, e-mail). Make sure you have the right to do so. We do not upload your phone’s address book to our servers.',
      'We do not ask for especially sensitive data (health, beliefs, sexual orientation, biometrics, etc.). If you include it in your messages or in the CRM, we treat it like any other content in order to provide the service; be careful what you share.',
    ] },
    { h: '3. What we use your data for and on what legal basis', p: [
      '• Providing the service (contract): creating and managing your account, delivering messages and calls, showing statuses and posts, syncing between your devices, sending the notifications and reminders you asked for, and enabling Business features.',
      '• Security and abuse prevention (legitimate interest and legal obligation): verifying your identity in account recovery, limiting sends, detecting spam, fraud and harmful behaviour, reviewing reports, suspending accounts and protecting people and the service.',
      '• Maintaining and improving the service (legitimate interest): diagnosing errors, measuring performance and fixing faults through logs and error monitoring, without building advertising profiles.',
      '• Service communications (contract and legitimate interest): sending you verification codes, security notices and important changes. We do not send you advertising.',
      '• Help and task assistants (contract and, where applicable, consent): processing your queries to answer you or propose actions.',
      '• Complying with legal obligations and responding to requests from authorities (legal obligation) and defending our rights (legitimate interest).',
      '• With your consent, where the law requires it (for example, for device notifications). You can withdraw it at any time without affecting what has already been done.',
      'We do not sell your personal data, we do not share it for targeted advertising and we do not use the content of your messages to train our own AI models.',
    ] },
    { h: '4. Who sees your information inside CIFRA', p: [
      'Your messages are seen by the people in the conversation. In a chat with a Business, besides the customer, the Business’s team members with access according to their role can see it.',
      'Your name, profile photo, @username, bio and cover are shown to people you interact with and, depending on your settings, to those who search for you. Your phone number is shown only to those who share a conversation with you, unless you turn on “hide phone”. You can turn off being found by number.',
      'Statuses are seen by your contacts; a Business’s posts are visible to its customers and, if the Business makes them public, to anyone who opens its public profile.',
      'Polls show counts to the chat’s participants but not who voted for each option. Whoever creates them can close them.',
    ] },
    { h: '5. Security', p: [
      'We protect data with reasonable technical and organisational measures: encrypted connections (HTTPS/TLS) between your device and our servers, encryption at rest of the database and storage by our providers, hashed passwords, row-level access policies in the database (each person can only access what belongs to them), rate limits, audit logs of moderation decisions and restricted staff access.',
      'Important: today CIFRA does not offer end-to-end encryption. This means that, although data travels and is stored encrypted, the service can technically access content in order to operate (for example, to deliver a message, build a preview or process a report). No system is completely invulnerable; if we detect a security breach affecting your data, we will tell you and notify the authority where the law requires it.',
    ] },
    { h: '6. Who we share data with', p: [
      'We share personal data only in the following cases:',
      '• With other people in the service, as explained in section 4.',
      '• With providers that process data on our behalf (processors), under contract and only to provide the service to us: database, authentication and file-storage provider (Supabase); hosting and server functions (Netlify); sending verification and recovery e-mails (Brevo); error monitoring (Sentry); artificial intelligence for the assistants (Anthropic); and your device’s or browser’s notification services (Apple, Google, Mozilla or others).',
      '• With authorities, courts or third parties when the law requires it, to protect people’s safety, to investigate abuse or fraud or to exercise or defend rights.',
      '• In corporate transactions (merger, acquisition or asset sale), with equivalent safeguards and telling you if the controller of your data changes.',
      'Providers may change over time; we keep this list up to date and will tell you about important changes.',
    ] },
    { h: '7. International transfers', p: [
      'Some of our providers may process data outside the European Economic Area, including the United States. When this happens, we ensure adequate safeguards exist, such as European Commission adequacy decisions, standard contractual clauses and supplementary measures where appropriate. You can ask us for more information about them.',
    ] },
    { h: '8. How long we keep data', p: [
      '• Account and profile: while you have the account. When you delete it we erase your profile, messages, statuses, contacts, files and notification devices, and the Businesses of which you are the only member. Data may remain in encrypted backups for a limited period (not more than 90 days) until overwritten.',
      '• Messages and files: until you or the other person delete them, until they expire if there is a timer (disappearing messages, incognito chats) or until the account is deleted. A deleted message is removed from view and erased from our systems; it may be kept briefly for technical or security reasons.',
      '• Statuses and posts: 24 hours (statuses) or 7 days (Business posts), after which they are deleted.',
      '• E-mail verification codes: they expire after 10 minutes and are erased when used or when the allowed attempts are exceeded.',
      '• Reports and moderation decisions: for as long as needed to protect people and the platform, and for the periods required by law.',
      '• Technical and error logs: for the time strictly necessary to diagnose and maintain security (normally weeks or a few months).',
      '• Data we must keep by legal obligation or to defend against claims: for the applicable legal periods, blocked and accessible only for those purposes.',
    ] },
    { h: '9. Your rights and how to exercise them', p: [
      'Under the applicable law (for example, the EU General Data Protection Regulation and equivalent rules) you have the right to:',
      '• Access your data and obtain a copy.',
      '• Rectify inaccurate data (you can edit your profile in the app).',
      '• Erase your data (“right to be forgotten”): you can do it yourself in Settings → Delete my account.',
      '• Restrict or object to processing based on legitimate interest.',
      '• Portability: receive the data you gave us in a structured, commonly used format, where applicable.',
      '• Withdraw consent at any time, where consent is the basis for processing.',
      '• Not be subject to decisions based solely on automated processing with significant legal effects. We do not make decisions of that kind; account suspensions go through human review.',
      `To exercise your rights write to us through ${contactLine('en')}. We may ask you to verify your identity. We will answer within the legal period (normally one month).`,
      'If you believe we process your data incorrectly, you have the right to lodge a complaint with the data-protection authority of your country or of the place where we are established.',
      'If your data is in a Business’s CRM record, address the Business first, as its controller; we will help it handle your request.',
    ] },
    { h: '10. Other people’s privacy and your control tools', p: [
      'You can block anyone (they will not be able to write to or call you), report contacts or Businesses, decide whether you can be found by phone number, hide your number, mute chats, use disappearing messages and incognito chats, protect the app with a PIN and sign out of your devices.',
      'Respect others’ privacy: do not share screenshots, data or conversations of other people without their permission, nor use CIFRA information against the law.',
    ] },
    { h: '11. Notifications, local storage and cookies', p: [
      'CIFRA does not use advertising or third-party tracking cookies. It uses browser or device storage (for example, local storage, local databases and the installable app’s service worker) to keep your session, remember settings (language, theme, chosen icon, statuses seen), save drafts and allow offline operation and notifications. It is necessary for the service to work and is not used to track you across sites. You can clear this data in your browser, although it will sign you out.',
      'If you turn on notifications, we store your device’s subscription to send you alerts; you can turn them off in Settings or on your device, and we delete the subscription.',
    ] },
    { h: '12. Information for Businesses: our role as processor', p: [
      'When a Business uses CIFRA to communicate with its customers and manage its CRM, calendar, catalogue and broadcasts, it processes its customers’ personal data as controller. CIFRA processes it as processor, solely to provide the service and following the Business’s documented instructions (the features the Business itself uses), applying the security measures described, helping it handle people’s rights, informing it of security breaches, not using it for our own purposes and deleting or returning it when the service ends. These Terms and this Policy form the processing agreement with the Business, and we can sign an additional agreement if it needs one.',
      'The Business must inform its customers about how it processes their data, have a legal basis for it and for broadcasts and commercial communications, and not enter data it cannot lawfully process.',
    ] },
    { h: '13. Artificial-intelligence assistants', p: [
      'When you use Maestro CIFRA or Doer, we send your query, the recent history of that conversation with the assistant and the minimum context needed (such as the list of your customers’ names in Doer) to our language-model provider to generate the answer. We do not send the rest of your conversations. The provider processes that data as our processor and does not use it to train its models under the terms applicable to our use. You can stop using the assistants at any time; avoid including sensitive data in your queries.',
    ] },
    { h: '14. Children', p: [
      'CIFRA is not aimed at children under 16 (or the minimum age of digital consent that applies in your country). We do not knowingly collect data from children below that age. If we find out that we have, we will delete the account and its data. If you are a parent or guardian and believe a child has given us data, contact us.',
    ] },
    { h: '15. Changes to this Policy', p: [
      'We may update this Policy. We will state above the date of the current version and, if the change is important, we will tell you in the app or by another reasonable means before it applies.',
    ] },
    { h: '16. Contact', p: [
      `Controller: ${o.full}.`,
      `For any privacy question or request: ${contactLine('en')}.`,
    ] },
  ],
};
