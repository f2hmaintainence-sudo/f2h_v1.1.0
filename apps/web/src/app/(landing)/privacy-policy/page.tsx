"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type Definition = {
  term: string;
  body: string;
};

type SubSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type PolicySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  definitions?: Definition[];
  subsections?: SubSection[];
  note?: string;
};

const sections: PolicySection[] = [
  {
    id: "about-f2h",
    title: "1. About F2H - Farm to Home",
    paragraphs: [
      "F2H - Farm to Home delivers fresh milk and dairy products, along with ghee, curd, paneer, kova, carrot halwa, cold-pressed oils, and dry fruits, directly to customers' doorsteps, with a focus on quality, freshness, convenience, and timely delivery. Select specialty items are curated from trusted local partners.",
      'F2H - Farm to Home ("Company", "F2H", "We", "Our", or "Us"), having its registered office at 1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore - 560066, Karnataka, India, owns and operates the brand F2H - Farm to Home, the website https://f2hfresh.com, its mobile application, and any related sub-domains or digital services (collectively, the "Platform"). The Platform enables customers to browse, order, purchase, subscribe to, and receive products and services offered by the Company.',
      'For the purposes of this Privacy Policy, wherever the context so requires, "You", "Your", or "User" refers to any natural or legal person, including a Buyer or Customer, who accesses or uses the Platform in any manner. The terms "Company", "F2H - Farm to Home", "We", "Our", or "Us" mean F2H - Farm to Home, its affiliates, employees, representatives, authorized service providers, and contractual partners, as the context may require.',
    ],
  },
  {
    id: "purpose",
    title: "2. Purpose and Application",
    paragraphs: [
      'This Privacy Policy explains how F2H - Farm to Home and relevant third parties engaged by Us collect, use, store, disclose, transfer, or otherwise process "Personal Information" from Buyers, Customers, Users, or any person who accesses or uses the Platform. It also describes the choices and rights available to You in relation to Your Personal Information.',
      "By accessing the Platform, registering an account, placing an order, using subscription services, making a payment, contacting customer support, or availing any product or service offered through the Platform, You agree to the terms of this Privacy Policy and consent to the collection, storage, possession, handling, sharing, disclosure, processing, and transfer of Your information as described herein. If You do not agree with this Privacy Policy, please do not use the Platform or avail any of Our products or services.",
      "We respect Your privacy and are committed to safeguarding Your Personal Information. We use reasonable administrative, technical, organizational, electronic, and physical safeguards to protect information as required under applicable law. You acknowledge that the Personal Information provided by You is provided voluntarily and that it is accurate, authentic, complete, and current. We will not be responsible for any dispute, claim, loss, or service issue arising from incorrect, incomplete, outdated, or misleading information provided by You.",
    ],
  },
  {
    id: "definitions",
    title: "3. Definitions",
    definitions: [
      {
        term: '"Applicable Law"',
        body: "means any national, state, regional, or local law, legislation, statute, regulation, ordinance, notification, policy, by-law, guideline, directive, code, approval, permit, judgment, court order, treaty, or governmental interpretation applicable to the Company, the Platform, or Our services, including the Information Technology Act, 2000, the Consumer Protection Act, 2019, the Digital Personal Data Protection Act, 2023, and rules framed thereunder, as applicable.",
      },
      {
        term: '"Cookies"',
        body: "means small text files or similar technologies stored on Your computer, mobile phone, tablet, or other device when You visit or use the Platform. Cookies help the Platform recognize a device, remember preferences, support core functionality, improve efficiency, analyze usage, and provide information to the owners or operators of the Platform.",
      },
      {
        term: '"Customer" or "Buyer"',
        body: "means any natural person or legal entity that accesses the Platform, accepts an offer for sale, places an order, purchases products, subscribes to deliveries, or avails any service offered through the Platform.",
      },
      {
        term: '"Personal Information"',
        body: "means any information relating to a natural person that directly or indirectly identifies such person, either alone or in combination with other information available or likely to be available with Us. Examples include name, mobile number, email address, delivery address, residential address, IP address, device details, account details, order history, transaction history, preferences, and payment-related information. It may also include sensitive information such as passwords and financial information, including bank account, credit card, debit card, UPI, wallet, or other payment instrument details, where applicable.",
      },
      {
        term: '"Processing"',
        body: "means any operation or set of operations performed on Personal Information, whether wholly or partly automated or otherwise, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, alignment, combination, indexing, sharing, disclosure by transmission, dissemination, restriction, erasure, or destruction.",
      },
      {
        term: '"Platform", "Site", or "Website"',
        body: "means the online shopping portal, mobile application, sub-domains, and related digital services owned or operated by F2H - Farm to Home through which customers may browse products, place orders, make payments, manage subscriptions, and avail services.",
      },
    ],
    note: "Any capitalized words used hereafter shall have the meaning assigned to them under this Privacy Policy.",
  },
  {
    id: "collection",
    title: "4. Collection of Personal Information",
    paragraphs: [
      "As part of registration, ordering, delivery, payment, customer support, surveys, subscriptions, offers, and the general use of the Platform, We may collect Personal Information about You and certain usage information.",
      "The Platform may contain links to third-party websites, applications, payment gateways, maps, communication tools, or service providers. You are requested to review the privacy practices of such third parties before proceeding. We are not responsible for the privacy practices, content, or security standards of websites or services that We do not own, manage, or control.",
    ],
    bullets: [
      "Information capable of identifying You, such as name, mobile number, email address, billing address, delivery address, location details, account credentials, and communication preferences.",
      "Financial and transaction-related information such as payment instrument details, transaction records, order history, refund records, preferred payment mode, spending patterns, subscription history, wallet or credit balance, and similar service data.",
      "Information about the pages You visit, products You view, links You click, features You use, number of visits, device identifiers, IP address, browser type, operating system, app version, referral source, and similar browsing or usage information.",
      "Information You provide directly through registration forms, online surveys, support requests, feedback forms, complaints, WhatsApp or phone support, promotional campaigns, contests, referrals, or any other voluntary interaction with Us.",
      "Information collected with Your consent while You navigate the Platform, including usage details, approximate location, IP address, Cookies, analytics identifiers, and data collected through similar tracking technologies.",
    ],
  },
  {
    id: "processing",
    title: "5. Processing the Personal Information",
    paragraphs: [
      "We process Your Personal Information only for lawful, business, service, safety, compliance, and operational purposes connected with the Platform and Our products or services.",
    ],
    bullets: [
      "To create, manage, authenticate, and maintain Your account on the Platform.",
      "To provide personalized features, recommendations, product availability, subscription options, delivery slots, and a better user experience.",
      "To process orders, subscriptions, deliveries, payments, refunds, cancellations, invoices, wallet balances, customer service requests, and related transactions.",
      "To provide promotional offers, service updates, reminders, account alerts, delivery notifications, marketing messages, and product recommendations through the Platform, WhatsApp, SMS, calls, email, push notifications, or other channels, subject to Your available opt-out choices.",
      "To share necessary information with delivery partners, payment processors, customer support teams, technology vendors, business associates, marketing partners, analytics providers, and other authorized service providers when required to provide products or services requested by You.",
      "To preserve transaction history, invoices, communications, audit logs, tax records, and other records as required under applicable law, accounting standards, internal policies, or legitimate business needs.",
      "To improve products, pricing, merchandising, features, availability, operational workflows, customer support, and overall service quality.",
      "To contact You for feedback, surveys, contest participation, complaint resolution, product updates, or important service-related information.",
      "To serve promotional or advertising materials, including through third-party advertising or analytics networks, and to measure, optimize, and personalize such campaigns.",
      "To generate aggregated or anonymized insights covering transaction data, customer demographics, location trends, product preferences, usage patterns, and service performance, without identifying You personally where reasonably possible.",
      "To understand customer needs, study how users interact with the Platform, evaluate feature performance, and conduct research on customer behavior and service usage.",
      "To process and respond to Your queries, complaints, requests, grievances, or legal notices.",
      "To investigate, prevent, detect, or take action regarding unlawful activity, suspected fraud, security threats, misuse of the Platform, violation of Our terms, disputes, or legal claims.",
      "To comply with subpoenas, court orders, regulatory requests, law enforcement requests, statutory duties, and other legal obligations.",
      "To allow You to participate in interactive features, referral programs, offers, subscriptions, or other services made available by Us.",
    ],
    note: "We aim to collect and process only the Personal Information reasonably necessary to provide Our products and services effectively. If You do not provide necessary information, deny required permissions, or withdraw consent for essential processing, We may be unable to provide certain services, complete orders, deliver products, process payments, resolve issues, or continue Your access to parts of the Platform.",
  },
  {
    id: "disclosure",
    title: "6. Disclosure of Your Personal Information",
    paragraphs: [
      "We do not use Your financial information for any purpose other than completing transactions, refunds, payment verification, fraud checks, accounting, compliance, or related payment services on the Platform.",
      "We do not rent or sell Your Personal Information. However, We may share Personal Information with third parties under written or contractual arrangements where such sharing is necessary for providing products or services requested by You, operating the Platform, improving Our services, protecting users, or complying with applicable law.",
      "We may engage service providers, contractors, delivery partners, payment processors, technology vendors, cloud providers, analytics providers, marketing partners, customer support providers, professional advisers, and other authorized third parties to help Us operate Our business. Such third parties are expected to maintain confidentiality, use reasonable security practices, and process Personal Information only for authorized purposes.",
      "If Our business is reorganized, merged, acquired, sold, transferred, or otherwise combined with another entity, Your Personal Information may be transferred to the relevant successor, buyer, merging entity, or acquiring entity, subject to reasonable efforts to ensure continued protection in accordance with applicable law.",
      "We may disclose Personal Information where We believe in good faith that disclosure is reasonably necessary to comply with legal or regulatory requirements, enforce Our terms, protect the safety and security of users or the public, prevent fraud, respond to lawful requests, or defend against legal claims.",
      "Other than as described in this Privacy Policy, where Your Personal Information is proposed to be shared with third parties in a materially different manner, We will provide notice or seek consent where required by applicable law.",
    ],
  },
  {
    id: "safeguards",
    title: "7. Safeguards to Protect Your Personal Information",
    paragraphs: [
      "We adopt reasonable security practices and procedures, including measures required under applicable law, to protect Your Personal Information against unauthorized access, disclosure, misuse, alteration, loss, or destruction.",
      "We use appropriate physical, electronic, technical, and managerial procedures to safeguard Personal Information shared with Us and with relevant third parties that have contractual arrangements with the Company. Access to Personal Information is restricted to authorized personnel and service providers who need such access to process orders, provide services, complete transactions, resolve issues, improve operations, or comply with legal obligations.",
      "Although We make reasonable efforts to protect Your Personal Information, transmission over the internet, mobile networks, and electronic storage systems cannot be guaranteed to be completely secure. By using the Platform, You acknowledge that We will not be liable for disclosure of Personal Information caused by unauthorized acts of third parties beyond Our reasonable control.",
      "If You suspect any data breach, unauthorized access, misuse, loss, or compromise of Your Personal Information, please contact Us immediately using the details provided in the Contact Us section of this Privacy Policy.",
    ],
  },
  {
    id: "retention",
    title: "8. Retention of Your Personal Information",
    paragraphs: [
      "We retain Your Personal Information for as long as necessary to provide access to the Platform, deliver products and services, maintain Your account, process transactions, resolve disputes, enforce agreements, meet legal and regulatory obligations, maintain business records, protect against fraud or misuse, and pursue legitimate business purposes.",
      "When Personal Information is no longer required for the purposes described above, We may delete, anonymize, aggregate, or securely archive it in accordance with applicable law and Our internal data retention practices.",
    ],
  },
  {
    id: "children",
    title: "9. Processing Personal Information of Children and Persons with Disabilities",
    paragraphs: [
      "We do not provide products or services directly to children under the age of 18 years and do not knowingly or proactively collect Personal Information from children without appropriate consent. Children may use Our products or services only through or with verifiable consent of a parent or lawful guardian.",
      "Similarly, a person with disability who has a lawful guardian may use Our products or services, provided the lawful guardian gives verifiable consent for processing the person's Personal Information where required under applicable law.",
      "The parent or lawful guardian, as applicable, assumes responsibility and legal liability for the conduct, access, orders, and use of the Platform by the child or person with disability, including monitoring such access and use.",
      "If We learn that Personal Information of a child or person with disability has been collected without required guardian consent, We may take appropriate steps to delete such information. If a lawful guardian discovers that such information has been submitted without consent, the guardian may request deletion by contacting Us through the details provided in the Contact Us section. We will act on such requests within a reasonable time and in accordance with applicable law.",
    ],
  },
  {
    id: "rights",
    title: "10. Rights of Users, Customers, and Buyers",
    bullets: [
      "You may opt out of certain collection or uses of Your Personal Information, including certain Cookies, similar technologies, and marketing communications, where such choice is available.",
      "You may request access to Personal Information provided by You and request correction, amendment, or updating of inaccurate or incomplete information.",
      "You may request information about the identities or categories of third parties with whom Your Personal Information has been shared for providing products or services requested by You, subject to applicable law and business confidentiality requirements.",
      "You may withdraw consent or alter Your preferences for the use of Your Personal Information. Withdrawal of consent may limit or prevent access to products, services, subscriptions, orders, delivery, payment, support, or parts of the Platform that depend on such information.",
      "You may request erasure or deletion of Your Personal Information, subject to retention required under applicable law, legal claims, accounting, compliance, fraud prevention, dispute resolution, or legitimate business purposes.",
      "You may nominate a person who may exercise Your rights in the event of Your death or inability, where such right is available under applicable law.",
      "You have the right to grievance redressal using the contact details provided in this Privacy Policy.",
    ],
    note: "To exercise any of these rights, please contact Us using the email address or details provided in the Contact Us section below.",
  },
  {
    id: "phishing",
    title: "11. Phishing",
    paragraphs: [
      'Identity theft and fraudulent practices commonly known as "phishing" are serious concerns. Phishing attempts may try to obtain Personal Information, payment details, passwords, or account access by pretending to be a legitimate organization.',
      "Protecting Your information is important to Us. We do not ask for credit card details, complete payment credentials, passwords, OTPs, or national identification numbers through unsolicited or unsecured email, phone calls, messages, or links. Please do not share such information with anyone claiming to represent F2H unless You are certain the communication is genuine and secure.",
    ],
  },
  {
    id: "cookies",
    title: "12. Cookies",
    paragraphs: [
      "We use Cookies and similar technologies across the Platform to support core functionality, improve performance, remember preferences, measure activity, analyze usage, optimize content, personalize experiences, and support advertising or marketing efforts.",
      "The Platform and third-party vendors, including analytics or advertising providers such as Google, may use first-party Cookies and third-party Cookies together to measure visits, understand interactions, optimize services, and serve or personalize ads based on past visits or usage patterns.",
    ],
    subsections: [
      {
        title: "Purpose for which Cookies are used",
        bullets: [
          "Enabling the Platform to function properly, including account access, location-based pages, cart or subscription behavior, payment flows, security checks, and detection of broken links or technical issues.",
          "Analyzing visitor behavior and Platform performance so We can understand which pages, products, links, and features are useful and where service improvements are needed.",
          "Optimizing and personalizing pages, product recommendations, promotions, content, and digital experiences based on Our understanding of Your preferences and requirements.",
        ],
      },
      {
        title: "Manage Your Cookies",
        paragraphs: [
          "You can choose whether to accept Cookies. If You decide not to accept Cookies, some features and services on the Platform may not function properly.",
          "You can change Your browser settings to notify You when a Cookie is received, choose whether to accept it, or automatically block Cookies. You can manage Cookies through the privacy settings of the browser You use. Blocking all Cookies may prevent access to certain parts of Our Platform or other websites.",
        ],
        bullets: [
          "Apple Safari: https://support.apple.com/en-in/guide/safari/manage-cookies-and-website-data-sfri11471/mac",
          "Google Chrome: https://support.google.com/chrome/answer/95647",
          "Microsoft Internet Explorer: https://support.microsoft.com/en-in/help/17442/windows-internet-explorer-delete-manage-cookies",
          "Mozilla Firefox: https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences",
        ],
      },
    ],
  },
  {
    id: "changes",
    title: "13. Changes to Privacy Policy",
    paragraphs: [
      "We reserve the right to change, modify, or update this Privacy Policy at any time for legal, administrative, operational, security, business, or technical reasons. Changes will be effective upon posting on the Platform unless stated otherwise.",
      "You can access the latest version of this Privacy Policy on the Platform at any time. Continued access to or use of the Platform after changes are posted will be treated as acceptance of the updated Privacy Policy, to the extent permitted by applicable law. This Privacy Policy should be read together with Our terms and conditions and other applicable policies.",
    ],
  },
  {
    id: "contact",
    title: "14. Contact Us",
    paragraphs: [
      "We take privacy seriously and aim to follow high standards while collecting and processing Personal Information. If You believe there is a concern with the way We process Your Personal Information, please contact Our grievance contact for prompt review and redressal.",
      "If You are not satisfied with the outcome of Our grievance redressal process, or if You believe Your complaint has not been handled correctly, You may approach the Data Protection Board of India or another competent authority, as may be applicable under law.",
    ],
    subsections: [
      {
        title: "Grievance contact",
        bullets: [
          "Grievance Officer: F2H - Farm to Home Grievance Officer",
          "Email: support@f2hfresh.com",
          "Primary phone: +91 91487 73591",
          "Secondary phone: +91 79893 68142",
          "WhatsApp: Message us on WhatsApp via the number listed on the Platform",
          "Registered office: 1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore - 560066, Karnataka, India",
          "Turnaround time: Within 3 working days of escalation, or within the time required under applicable law.",
        ],
        paragraphs: [
          "If You wish to make a complaint regarding any violation of this Privacy Policy, You may send a written complaint to the grievance contact mentioned above. The complaint will be reviewed and redressed in accordance with applicable law.",
        ],
      },
    ],
  },
];

function renderBullets(items?: string[]) {
  if (!items?.length) return null;

  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-slate-600 sm:text-sm">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function renderParagraphs(items?: string[]) {
  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <p key={item} className="text-[13px] leading-6 text-slate-600 sm:text-sm">
          {item}
        </p>
      ))}
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f7faf8]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="mx-auto max-w-[1240px] px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-emerald-700">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-semibold text-slate-800">Privacy Policy</span>
        </nav>

        <article className="rounded-[8px] border border-slate-200 bg-white px-4 py-7 shadow-sm sm:px-6 lg:px-7">
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              F2H - Farm to Home
            </p>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-[28px]">
              Privacy Policy
            </h1>
          </div>

          <div className="space-y-7">
            {sections.map((section, index) => {
              const [sectionNumber, ...sectionTitleParts] = section.title.split(". ");
              const sectionTitle = sectionTitleParts.join(". ");

              return (
                <section
                  key={section.id}
                  id={section.id}
                  className={`scroll-mt-28 ${index === 0 ? "" : "border-t border-slate-100 pt-7"}`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                      {sectionNumber}
                    </span>
                    <h2 className="pt-0.5 text-[15px] font-bold leading-6 tracking-normal text-slate-950 sm:text-base">
                      {sectionTitle}
                    </h2>
                  </div>

                  <div className="ml-10 border-l border-emerald-100 pl-4">
                    {renderParagraphs(section.paragraphs)}
                    {renderBullets(section.bullets)}

                    {section.definitions?.length ? (
                      <ul className="mt-3 space-y-3">
                        {section.definitions.map((definition) => (
                          <li key={definition.term} className="text-[13px] leading-6 text-slate-600 sm:text-sm">
                            <span className="font-semibold text-slate-900">{definition.term}</span>{" "}
                            {definition.body}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {section.subsections?.map((subsection) => (
                      <div key={subsection.title} className="mt-4 rounded-[8px] border border-slate-100 bg-slate-50/80 p-4">
                        <h3 className="mb-2 text-sm font-semibold text-slate-900">
                          {subsection.title}
                        </h3>
                        {renderParagraphs(subsection.paragraphs)}
                        {renderBullets(subsection.bullets)}
                      </div>
                    ))}

                    {section.note ? (
                      <p className="mt-4 rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-medium leading-6 text-emerald-900 shadow-[inset_3px_0_0_0_rgba(5,150,105,0.35)] sm:text-sm">
                        {section.note}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}