import React from "react";
import { ArrowRight, ArrowUpRight, BookOpen, ShieldCheck } from "lucide-react";
import "./resources.css";
const register =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";
const skilled = "https://www.gov.uk/skilled-worker-visa/your-job";
const adviser = "https://www.gov.uk/find-an-immigration-adviser";
export const articles = [
  {
    slug: "check-uk-sponsor",
    tag: "START WITH THE EVIDENCE",
    title: "Is this employer a UK sponsor?",
    description:
      "Check the register, match the name and know what a licence does—and doesn’t—tell you.",
    time: "3 min read",
  },
  {
    slug: "sponsorship-in-job-adverts",
    tag: "READ BETWEEN THE LINES",
    title: "What does the job advert actually say?",
    description:
      "Make sense of sponsorship wording before you spend time on an application.",
    time: "3 min read",
  },
  {
    slug: "build-a-shortlist",
    tag: "A SMALL STEP TODAY",
    title: "Three employers. One clearer next step.",
    description:
      "Turn a long list of possibilities into a manageable application routine.",
    time: "3 min read",
  },
];
export function GuideLinks() {
  return (
    <section className="resource-section" aria-labelledby="practical-guides">
      <p className="eyebrow">LESS GUESSWORK. MORE PROGRESS.</p>
      <h2 id="practical-guides">A clearer way to search.</h2>
      <div className="resource-grid">
        {articles.map((a) => (
          <a className="resource-card" key={a.slug} href={"/guides/" + a.slug}>
            <span className="resource-icon">
              <BookOpen size={21} />
            </span>
            <span className="eyebrow">{a.tag}</span>
            <h3>{a.title}</h3>
            <p>{a.description}</p>
            <strong>
              {a.time}
              <ArrowRight size={18} />
            </strong>
          </a>
        ))}
      </div>
    </section>
  );
}
function SourceLinks() {
  return (
    <aside className="article-sources">
      <h2>Go straight to the source</h2>
      <a href={register}>
        GOV.UK: register of licensed sponsors <ArrowUpRight size={15} />
      </a>
      <a href={skilled}>
        GOV.UK: Skilled Worker job requirements <ArrowUpRight size={15} />
      </a>
      <a href={adviser}>
        GOV.UK: find a regulated immigration adviser <ArrowUpRight size={15} />
      </a>
      <p>
        General research guidance, prepared 4 October 2026. Sponsor Intel is
        independent of the UK government and does not assess your immigration
        eligibility. Read the current official guidance before making a
        decision.
      </p>
    </aside>
  );
}
export function ResourceArticle({ view }: { view: string }) {
  const article = articles.find((a) => view === "guides/" + a.slug);
  if (!article) return null;
  return (
    <article className="resource-article">
      <nav className="article-crumbs" aria-label="Breadcrumb">
        <a href="/">Discover</a>
        <span>/</span>
        <a href="/guides">Career guides</a>
      </nav>
      <header>
        <p className="eyebrow">{article.tag}</p>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        <span className="article-byline">
          Sponsor Intel · {article.time} · 4 October 2026
        </span>
      </header>
      <div className="article-body">
        {article.slug === "check-uk-sponsor" && (
          <>
            <p>
              Finding a company on the UK sponsor register is a useful first
              check. It is not an offer of work or a promise that the company
              will sponsor your application. Treat it as the beginning of your
              research.
            </p>
            <h2>1. Match the employer’s legal name</h2>
            <p>
              A familiar brand may use a different company name in its job
              advert or employment contract. Search the name in the advert, then
              compare the city and any other identifying details. If the match
              is unclear, ask the employer which legal entity would employ you.
              Do not assume that every company in the same group has the same
              licence.
            </p>
            <h2>2. Read the route and the source date</h2>
            <p>
              The official register lists sponsor routes and ratings. Check the
              route relevant to the role and open the latest GOV.UK register
              before acting. Sponsor Intel makes the published records easier to
              search, but an older snapshot cannot confirm today’s licence
              status.
            </p>
            <h2>3. Check the actual vacancy</h2>
            <p>
              Use the employer’s own careers page to find an open role. Check
              its location, responsibilities and application deadline. A
              licensed employer can advertise roles for which it does not offer
              sponsorship. The job, pay and your circumstances also matter under
              the immigration rules.
            </p>
            <h2>4. Ask a specific question</h2>
            <blockquote>
              “Is sponsorship available for this vacancy, and which legal entity
              would employ and sponsor the successful candidate?”
            </blockquote>
            <p>
              Keep the answer with the vacancy link and the date you checked. A
              written answer helps you decide where to focus your effort; it
              does not replace the official visa requirements.
            </p>
            <div className="article-action">
              <ShieldCheck size={24} />
              <div>
                <strong>Try it with one employer.</strong>
                <p>
                  Search its name, check the listed route and save it while you
                  research the role.
                </p>
              </div>
              <a href="/">
                Search employers <ArrowRight size={17} />
              </a>
            </div>
          </>
        )}
        {article.slug === "sponsorship-in-job-adverts" && (
          <>
            <p>
              A sponsor licence and the wording in a job advert answer different
              questions. The licence relates to the employer. The advert gives
              evidence about a particular vacancy. Keep both in view when
              deciding whether to apply.
            </p>
            <h2>Four labels, four different meanings</h2>
            <dl className="evidence-definitions">
              <dt>Offered</dt>
              <dd>
                The advert contains wording offering sponsorship. Read the
                quotation and the full role requirements; the wording is not a
                personal eligibility decision.
              </dd>
              <dt>Conditional</dt>
              <dd>
                The advert mentions sponsorship with conditions or limits.
                Identify those conditions and ask the employer how they apply to
                this role.
              </dd>
              <dt>Not stated</dt>
              <dd>
                We did not find clear sponsorship wording in the imported
                advert. This is an unknown, so confirm with the employer. A
                register entry cannot fill that gap.
              </dd>
              <dt>Unavailable</dt>
              <dd>
                The advert contains wording that sponsorship is not available,
                or that applicants must not require it. Read the full sentence
                before deciding your next step.
              </dd>
            </dl>
            <h2>Read the evidence before the label</h2>
            <p>
              Sponsor Intel extracts wording from selected employer job boards.
              Automated labels can miss nuance, and employers can change their
              adverts. Open the original listing and compare the quotation with
              the current text. Use “Leave feedback” if the label and the source
              disagree.
            </p>
            <h2>Ask about the exact vacancy</h2>
            <blockquote>
              “I’m interested in [role title and reference]. Does this vacancy
              support Skilled Worker sponsorship, and are there any restrictions
              applicants should know before applying?”
            </blockquote>
            <p>
              Use the employer’s published recruitment channel. Keep the reply
              in your application notes so that you do not have to repeat the
              same research later.
            </p>
            <h2>A salary figure does not settle eligibility</h2>
            <p>
              A published pay range is useful evidence, but it does not
              establish whether an offer meets the immigration rules.
              Occupation, hours, the actual offer and applicable conditions can
              matter. Check the current GOV.UK requirements or get qualified
              advice for your circumstances.
            </p>
            <div className="article-action">
              <BookOpen size={24} />
              <div>
                <strong>Read a role with the evidence beside it.</strong>
                <p>
                  Open a vacancy and compare its sponsorship label with the
                  original advert.
                </p>
              </div>
              <a href="/jobs">
                Explore vacancies <ArrowRight size={17} />
              </a>
            </div>
          </>
        )}
        {article.slug === "build-a-shortlist" && (
          <>
            <p>
              A long list of applications can be hard to maintain. Try a smaller
              research session: three employers, one role worth investigating
              and a clear next action. This is a practical routine, not a
              promise of interviews.
            </p>
            <h2>Start with the work you can demonstrate</h2>
            <p>
              Write down two role titles that fit your experience and three
              skills you can support with examples. Include evidence from study,
              projects, volunteering or paid work. Use those terms to search the
              employer’s vacancies; do not depend on “visa sponsorship” as your
              only keyword.
            </p>
            <h2>Save three employers in places you could work</h2>
            <p>
              Search Sponsor Intel by city or employer name. Read the licence
              route and check the official register. Save a small selection,
              then visit each employer’s careers page. Treat a company with no
              suitable vacancy as a research lead, not as a live application.
            </p>
            <h2>Check the role before tailoring your CV</h2>
            <p>
              Compare the responsibilities, required experience, location, pay
              if stated and sponsorship wording. Keep unanswered questions
              beside the role. If an advert is unclear, ask the employer about
              the exact vacancy before making assumptions.
            </p>
            <h2>Use your own examples</h2>
            <p>
              Choose two or three requirements you genuinely meet. For each one,
              describe something you did and the result you can evidence. The
              application studio can help organise a draft, but you should check
              every line and remove any claim you cannot support.
            </p>
            <h2>Finish with one next action</h2>
            <p>
              Record the application link, the date, the stage and a sensible
              follow-up date. Next time you open your tracker, continue from
              that action instead of starting the same search again. If the
              employer asks applicants not to follow up, respect that
              instruction.
            </p>
            <div className="article-action">
              <BookOpen size={24} />
              <div>
                <strong>Make your first shortlist today.</strong>
                <p>
                  You can search and save employers without creating an account.
                </p>
              </div>
              <a href="/">
                Find three employers <ArrowRight size={17} />
              </a>
            </div>
          </>
        )}
      </div>
      <SourceLinks />
      <GuideLinks />
    </article>
  );
}
export function AboutPage() {
  return (
    <article className="resource-article">
      <header>
        <p className="eyebrow">THE EVIDENCE BEHIND YOUR NEXT STEP</p>
        <h1>Clear sources. Honest limits.</h1>
        <p>
          Sponsor Intel brings employer research, vacancies, application
          preparation and immigration updates into one free beta workspace for
          international talent.
        </p>
        <span className="article-byline">
          Sponsor Intel · Updated 4 October 2026
        </span>
      </header>
      <div className="article-body">
        <h2>Employer records</h2>
        <p>
          Our directory comes from the UK government’s register of licensed
          sponsors for workers. We combine duplicate name-and-location records
          and keep the listed routes and ratings. Counts describe
          employer/location records, not unique legal companies or current jobs.
          The directory shows the source date and flags delayed refreshes.
        </p>
        <h2>Vacancy evidence</h2>
        <p>
          We read selected employer job boards through Greenhouse, Lever and
          Ashby interfaces. This is a focused collection, not the whole UK job
          market. We check the boards every six hours; listings not seen
          successfully for more than three days are excluded from search. A
          failed refresh does not prove a role has closed.
        </p>
        <p>
          Sponsorship labels are automated interpretations of the imported
          advert. They are shown with supporting wording where available. We
          never turn a sponsor-register entry into a claim that a particular
          vacancy offers sponsorship. The employer’s current listing remains the
          place to confirm details and apply.
        </p>
        <h2>Immigration updates</h2>
        <p>
          We check selected GOV.UK guidance and recent rule publications every
          15 minutes. A detected change is separate from the date a rule takes
          effect. Plain-English explanations are linked to a checked version of
          the official text. We hide an explanation when that text changes, is
          withdrawn or cannot be confirmed recently. Some publications still
          need an explanation; those link directly to the source.
        </p>
        <h2>Your application workspace</h2>
        <p>
          Hire Stack tools are integrated here to help you organise a CV, draft
          application documents and track next steps. Guest work stays in this
          browser; creating an account lets you save your career workspace
          online. Optional AI assistance requires your choice before sending the
          selected application context. You review and submit your own
          applications.
        </p>
        <h2>Corrections and support</h2>
        <p>
          Use “Leave feedback” at the bottom of any page to report a broken
          link, incorrect label or outdated explanation. Include the employer or
          page name and what needs checking. Do not include passport details,
          immigration documents or other sensitive personal information.
        </p>
        <p>
          Sponsor Intel is an independent product, not a government service,
          recruitment agency or regulated immigration adviser. It cannot
          guarantee sponsorship, a job or a visa decision.
        </p>
      </div>
      <SourceLinks />
    </article>
  );
}
