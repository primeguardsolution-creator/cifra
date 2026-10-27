import { COMPANY, Doc, contactLine, operator } from './company';

const o = operator('en');
const law = COMPANY.law.en.trim();

export const termsEn: Doc = {
  title: 'Terms of Use',
  intro: [
    `These Terms of Use (“Terms”) govern your use of CIFRA, the messaging app with a Personal space and a Business space provided by ${o.full} (“CIFRA”, “we”, “us”). By creating an account or using CIFRA you accept these Terms and our Privacy Policy. If you do not agree, do not use the service.`,
    'We have tried to write them clearly. Headings are for guidance and do not limit the content of each section.',
  ],
  sections: [
    { h: '1. What CIFRA is', p: [
      'CIFRA is a messaging service for people and businesses. It includes one-to-one and group chats, voice and video calls, statuses (24-hour posts), voice notes, files, incognito chats, disappearing messages, polls, a help assistant and, in the Business space, a customer inbox, calendar, CRM, catalogue, posts, broadcasts, quick replies, a public profile and a task assistant (Doer).',
      'The service is provided as an installable web app (PWA) and may also be offered as an iOS and Android app. Some features may vary by device, browser or version.',
    ] },
    { h: '2. Definitions', p: [
      '• “Service”: CIFRA and all of its features, websites, apps and related communications.',
      '• “User” or “you”: the person using CIFRA.',
      '• “Content”: everything you send, upload, post or share (messages, photos, videos, audio, files, statuses, posts, polls, names, profile pictures, catalogues, notes, etc.).',
      '• “Business”: a company, self-employed or organisation account created in the Business space.',
      '• “Customer”: a person who communicates with a Business or appears in its CRM.',
    ] },
    { h: '3. Who can use CIFRA', p: [
      'You must be at least 16 years old (or the minimum legal age to consent to the processing of your data in your country, if higher) and have the capacity to accept these Terms. If you use CIFRA on behalf of a company, you state that you have authority to bind it.',
      'You may not use CIFRA if we have suspended or banned you, if the law prevents you from doing so, or if you would be using the service from a country subject to sanctions that prohibit it.',
      'If you are a parent or guardian and believe a child under the minimum age uses CIFRA, contact us through the channels in the contact section and we will delete the account.',
    ] },
    { h: '4. Your account', p: [
      'You sign up with your phone number, your name and a password. You must give us truthful information and keep it up to date. Only one account is allowed per phone number and you must be the person who controls it.',
      'You are responsible for activity from your account and for keeping your password and recovery code secret. Tell us without delay if you think someone is accessing your account without permission.',
      'You can add a verified recovery e-mail and create a one-time recovery code in Settings → Account security. If you forget your password and have neither, we will not be able to recover your account, because we have no other way to verify that it is you.',
      'You can sign out at any time and delete your account in Settings → Delete my account (see section 20).',
    ] },
    { h: '5. Acceptable use', p: [
      'To keep CIFRA safe, you agree not to do or allow any of the following:',
      '• Send spam, unsolicited advertising, chain messages, bulk messages or commercial communications without the consent required by law.',
      '• Harass, threaten, intimidate, defame, humiliate or discriminate against others, or incite hatred or violence based on origin, race, religion, sex, sexual orientation, disability, age or other protected characteristics.',
      '• Post or send non-consensual explicit sexual content, content that sexualises minors (which we will report to the authorities) or content showing extreme violence.',
      '• Impersonate another person, company or entity, or use another person’s identity data.',
      '• Commit or facilitate fraud, scams, impersonation, phishing, money laundering or the sale of illegal goods or services.',
      '• Infringe third parties’ intellectual property, trade secrets, privacy or image rights.',
      '• Upload malware or harmful code, or try to access accounts, systems or data without permission; probe, scan or test vulnerabilities without our written authorisation.',
      '• Interfere with the service: overload it, automate account creation or message sending, collect other users’ data in bulk (scraping), decompile the code except where the law allows, or bypass technical limits, blocks or security measures.',
      '• Use CIFRA to collect or process other people’s personal data in breach of applicable law.',
      '• Use the service for purposes the law prohibits or that put people’s safety at risk.',
      'We may apply reasonable limits (for example, messages per hour or broadcasts per day) to protect the service and its users.',
    ] },
    { h: '6. Your content and the permissions you give us', p: [
      'Your content is yours. We do not claim ownership of it. You are responsible for it and you guarantee that you have the rights needed to send it and that it does not break the law or third-party rights.',
      'So that we can provide the service, you grant us a worldwide, non-exclusive, royalty-free, limited licence to host, store, transmit, technically process (for example, resize images, compress videos or generate link previews), display to the recipients you choose and copy your content, solely to operate, maintain and improve the security and operation of CIFRA. The licence ends when the content is deleted, except for backups and the cases described in the Privacy Policy.',
      'We do not use the content of your messages for advertising and we do not sell it to third parties.',
      'Statuses, a Business’s public posts, profile photos, covers and a Business’s public profile may be visible to other people depending on the visibility settings you choose. Think before you post.',
    ] },
    { h: '7. Messages, calls and special features', p: [
      'Messages are delivered to recipients’ devices. Once a message is delivered, a person can copy it, forward it or take a screenshot; we cannot prevent or control this.',
      'Disappearing messages: if you set a timer in a chat, new messages are hidden and deleted from our systems when it expires. We cannot guarantee deletion from other people’s devices, from copies someone has made (screenshots, forwards, device backups) or from attachments already downloaded.',
      'Incognito chats: they are deleted automatically after a period of inactivity or when both people ask. The same limitations as for disappearing messages apply.',
      'Deleted messages: deleting a message removes it from the chat for participants, but it may be kept briefly for technical or security reasons.',
      'Calls: voice and video calls use device-to-device communication technology (WebRTC) and, when needed, relay servers. You can block anyone who calls you without your consent. Do not use CIFRA for emergency calls: it does not replace a telephone service and does not guarantee the caller’s location.',
      'Polls: answers are private (counts are shown, not who voted for what). Whoever creates a poll is responsible for its content.',
      'Statuses: personal statuses last 24 hours and Business posts last 7 days, after which they stop being shown and are deleted.',
    ] },
    { h: '8. Business space', p: [
      'If you create a Business you are its holder within CIFRA. You are responsible for the accuracy of its information (name, description, hours, prices and catalogue), for posts, automatic replies, your team’s messages and for complying with the law applicable to your activity: consumer, advertising, e-commerce, tax, data protection, etc.',
      'Team and roles: you can invite other people as admin, supervisor, agent or read-only. Anyone with access can see the Business’s conversations and data according to their role. You are responsible for what people you give access to do and for removing their access when appropriate. Internal notes are visible only to the team.',
      'Customers and personal data: for your customers’ data (conversations, CRM records, appointments, tags, notes) you are, as a rule, the controller and CIFRA acts as the processor that hosts and processes them on your instructions, as explained in the Privacy Policy. You must inform your customers about how you process their data, have a legal basis for it and handle their rights.',
      'A Business may not use CIFRA to contact people with no relationship to it, nor to sell, resell or hand over its customers’ data.',
      'If a Business has other team members, you cannot delete your account while you are its owner until you hand it over or remove the team.',
    ] },
    { h: '9. Broadcasts and commercial communications', p: [
      'The broadcast feature lets a Business’s management send one message to customers who have a CIFRA account. You may use it only for communications related to your activity that recipients reasonably expect or have agreed to receive, respecting the commercial-communications rules (for example, e-commerce and data-protection law) of the places where recipients are.',
      'Each broadcast is labelled as such and offers a link to stop receiving them. We honour that opt-out and you must honour it through any other channel too. We apply limits (currently three broadcasts per Business every 24 hours) and may lower them or suspend the feature in case of abuse.',
    ] },
    { h: '10. Links, previews and third-party content', p: [
      'CIFRA can show link previews (a page’s title, description and image). To build them, our servers fetch the linked page with security restrictions. We do not control third-party sites nor are we responsible for their content or privacy practices; if you follow a link, you do so at your own risk.',
      'Business profiles, catalogues and posts are those Businesses’ content, not ours.',
    ] },
    { h: '11. Artificial-intelligence assistants', p: [
      'CIFRA includes a help assistant (“Maestro CIFRA”) and, for Businesses, an assistant that proposes and carries out tasks (Doer). They may rely on third-party AI models. When you use the assistant, the text of your question and the minimum context needed (for example, the list of your customers’ names so that Doer understands whom you mean) are sent to the model provider to generate the answer.',
      'Answers may be wrong, incomplete or out of date and are not professional advice (legal, tax, medical, financial or otherwise). Doer shows you the actions it proposes and only carries them out when you confirm; always review what you are about to approve. Do not enter especially sensitive data into assistant queries.',
    ] },
    { h: '12. Notifications', p: [
      'If you turn them on, we will send you system notifications (for example, new messages or appointment reminders) through Apple, Google, Mozilla or other notification services depending on your device. You can turn them on or off separately for your Personal space and for Business in Settings and in your device settings. For privacy, notifications of incognito chats do not show the content.',
    ] },
    { h: '13. Moderation, reports and blocks', p: [
      'You can block other people and report contacts, messages, Businesses or content that breach these Terms. We review reports and may remove content, limit features, and suspend or close accounts, temporarily or permanently, when you breach these Terms, when the law or other people’s safety requires it, or when an authority requires us to.',
      'Whenever reasonable and lawful, we will tell you the reason for the measure and how you can reply or ask for a review by writing to us through the contact channels. Chats are private: we do not generally monitor the content of conversations, but we may review content that is reported to us and act on it.',
      'If we believe in good faith that there is a risk to someone’s life or physical integrity, or a crime, we may disclose the necessary information to the competent authorities.',
    ] },
    { h: '14. Intellectual property and infringement notices', p: [
      'CIFRA, its name, logos, design, software and own content are protected by intellectual and industrial property rights and belong to their owners. We grant you a personal, limited, revocable, non-exclusive, non-transferable licence to use the service in accordance with these Terms. You may not copy, modify, distribute, sell or create derivative works of the service, except as the law or an open-source licence applicable to certain components allows.',
      `If you believe content on CIFRA infringes your rights (for example, copyright or trademark), tell us with your contact details, the identification of the content, a description of your right and a good-faith statement, through ${contactLine('en')}. We will remove or block manifestly infringing content and may close the accounts of repeat infringers.`,
    ] },
    { h: '15. Third-party services and providers', p: [
      'To provide CIFRA we rely on providers of infrastructure, database and authentication, hosting, e-mail, notifications, error monitoring and artificial intelligence. They are described in the Privacy Policy. Their use may also be subject to their own terms (for example, those of your browser, operating system or app store). Apple, Google and others are not a party to these Terms nor responsible for the service.',
    ] },
    { h: '16. Availability, test version and changes to the service', p: [
      'We work to keep CIFRA running continuously, but we do not guarantee that it will always be available or error-free. There may be interruptions due to maintenance, third-party failures or causes beyond our control.',
      'While the service is labelled a test version (“beta”) there may be changes, errors, limitations or deletion of test data, and you should not entrust it with information you cannot afford to lose. Keep a copy of what matters.',
      'We may add, change or remove features, apply usage limits or offer paid plans in the future. If we introduce prices, we will tell you before charging anything and will not charge you without your express consent.',
    ] },
    { h: '17. Payments', p: [
      'Today CIFRA does not charge for the service and does not process payments between people or with Businesses. If payments, subscriptions or fees are introduced in the future, they will be governed by additional terms shown to you before you accept any charge. Purchases and payments a Business agrees with its customers outside CIFRA are the sole responsibility of both parties.',
    ] },
    { h: '18. Warranties and limits of liability', p: [
      'The service is provided “as is” and “as available”. To the extent permitted by law, we give no warranty that it will meet your specific needs, work without interruption or errors, or that other people’s content or the assistants’ answers are accurate.',
      'To the extent permitted by law, we will not be liable for indirect damages, lost profit, loss of data, customers or opportunities, nor for damage arising from other users’ or third parties’ content or conduct, from unauthorised access not due to our negligence, or from force majeure.',
      'Our total liability to you for any claim relating to the service will be limited, to the extent permitted by law, to what you paid CIFRA in the 12 months before the event or, if you paid nothing, to 100 euros.',
      'Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, including liability for intent or gross negligence, for harm to life, physical integrity or health, or the non-waivable rights that consumer law gives you.',
    ] },
    { h: '19. Indemnity', p: [
      'To the extent permitted by law, you agree to hold us harmless from third-party claims, damages and reasonable expenses (including legal fees) arising from your content, your breach of these Terms or the law, or your use of the service for your activity. If you are a consumer, this clause applies only within the limits allowed by consumer-protection law.',
    ] },
    { h: '20. Termination and account deletion', p: [
      'You can stop using CIFRA whenever you want and delete your account in Settings → Delete my account. We will ask for your password and a confirmation. Deleting it removes your profile, messages, statuses, contacts, notification devices and the files you uploaded, and the Businesses of which you are the only member. Shared conversations continue for the other people, without your messages. It cannot be undone. If you own a Business with a team, you must first hand it over or remove the team.',
      'We may suspend or close your account or restrict features if you breach these Terms, if there is a risk to other people or to the service, if the law requires it, or if you have not used it for a long time, notifying you when reasonable. Sections that by their nature should survive (for example, intellectual property, limits of liability and governing law) remain in force after termination.',
    ] },
    { h: '21. Changes to these Terms', p: [
      'We may update these Terms to reflect changes to the service, the law or our practices. If the change is important, we will tell you in the app or by another reasonable means before it takes effect. If you keep using CIFRA after that date, we will understand that you accept the new version; if you disagree, you may stop using the service and delete your account.',
    ] },
    { h: '22. Governing law and dispute resolution', p: [
      law
        ? `These Terms are governed by the law of ${law}, without prejudice to the mandatory consumer-protection rules of the country where you live, which will continue to apply if they are more favourable to you. The competent courts will be those determined under the applicable law; if you are a consumer, you may also go to the courts of your country of residence.`
        : 'These Terms are governed by the law of the country where the service holder is established, without prejudice to the mandatory consumer-protection rules of the country where you live, which will continue to apply if they are more favourable to you. If you are a consumer, you may also go to the courts of your country of residence.',
      'Before going to court we encourage you to write to us to try to resolve the dispute in good faith. If you live in the European Union you may also use online dispute-resolution mechanisms and your country’s consumer authorities.',
    ] },
    { h: '23. General provisions', p: [
      'If any part of these Terms is found invalid or unenforceable, the rest remains in force. Our not exercising a right does not mean we waive it. You may not assign your rights or obligations without our consent; we may assign ours to an entity that continues the service, informing you. These Terms and the Privacy Policy are the entire agreement between you and us about the service. We may offer them in several languages; in case of discrepancy, the Spanish version prevails unless the law requires otherwise.',
    ] },
    { h: '24. Contact', p: [
      `Service provider: ${o.full}.`,
      `For questions, reports, legal or privacy requests, write to us through ${contactLine('en')}.`,
    ] },
  ],
};
