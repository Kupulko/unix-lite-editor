import React from "react";
import BrandLogo from "./BrandLogo";

type LandingPageProps = {
  hasSession: boolean;
  onGetStarted: () => void;
  onLogin: () => void;
  onProjects: () => void;
};

const featureCards = [
  {
    title: "Glass-first editor",
    text: "Compose polished layouts with panels, floating tools, gradients and code-ready structures.",
    icon: "◫",
  },
  {
    title: "Smart presets",
    text: "Headers, cards, inputs, buttons and sections are prepared for cleaner export into UI code.",
    icon: "▣",
  },
  {
    title: "Project library",
    text: "Create, name, reopen and manage ideas before entering the editor workspace.",
    icon: "◈",
  },
  {
    title: "Visual hierarchy",
    text: "Layers, properties and scene tools stay close, but the canvas remains the center of attention.",
    icon: "⌘",
  },
  {
    title: "Future-friendly export",
    text: "Semantic metadata makes it easier to transform designs into reusable components later.",
    icon: "</>",
  },
  {
    title: "Built to iterate",
    text: "Start from a clean project, experiment fast and keep each concept in its own collection.",
    icon: "↺",
  },
];

export default function LandingPage({
  hasSession,
  onGetStarted,
  onLogin,
  onProjects,
}: LandingPageProps) {
  return (
    <div className="marketingShell">
      <header className="marketingHeader glassMarketingBar">
        <button className="brandResetButton" type="button" onClick={() => document.querySelector<HTMLElement>(".marketingShell")?.scrollTo({ top: 0, behavior: "smooth" })}>
          <BrandLogo compact />
        </button>

        <nav className="marketingNav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#projects">Projects</a>
          <a href="#start">Start</a>
        </nav>

        <div className="marketingHeaderActions">
          {hasSession ? (
            <button className="marketingGhostBtn" type="button" onClick={onProjects}>
              Projects
            </button>
          ) : (
            <button className="marketingGhostBtn" type="button" onClick={onLogin}>
              Log in
            </button>
          )}

          <button className="marketingPrimaryBtn" type="button" onClick={onGetStarted}>
            Get started
          </button>
        </div>
      </header>

      <main className="marketingMain">
        <section className="marketingHero">
          <div className="marketingEyebrow">A visual editor that thinks ahead to code</div>
          <h1>Design interfaces that already know how to become products.</h1>
          <p>
            ORIX is a Figma-inspired editor with a glass UI, structured components,
            floating panels and a workflow built for future export into real web projects.
          </p>

          <div className="marketingHeroActions">
            <button className="marketingPrimaryBtn large" type="button" onClick={onGetStarted}>
              Start designing
            </button>
            <button className="marketingGhostBtn large" type="button" onClick={hasSession ? onProjects : onLogin}>
              {hasSession ? "Open projects" : "View sign in"}
            </button>
          </div>

          <div className="heroMetricStrip">
            <span><strong>Code-ready</strong> templates</span>
            <span><strong>Glass</strong> workspace</span>
            <span><strong>Project</strong> dashboard</span>
          </div>
        </section>

        <section className="editorShowcase glassShowcase" aria-label="Editor preview">
          <div className="editorShowcaseGlow" />
          <div className="mockEditorTop">
            <div className="mockDots"><i /><i /><i /></div>
            <span>ORIX / Hero landing concept</span>
            <button type="button">Export</button>
          </div>

          <div className="mockEditorBody">
            <aside className="mockRail">
              <i>＋</i>
              <i>◧</i>
              <i>▣</i>
            </aside>

            <div className="mockCanvas">
              <div className="mockArtboard">
                <div className="mockHeroTitle" />
                <div className="mockHeroLine short" />
                <div className="mockHeroLine" />
                <div className="mockHeroButtons">
                  <span />
                  <span />
                </div>
                <div className="mockCards">
                  <b />
                  <b />
                  <b />
                </div>
              </div>
            </div>

            <aside className="mockProperties">
              <strong>Properties</strong>
              <span />
              <span />
              <span />
              <div />
            </aside>
          </div>
        </section>

        <section id="features" className="marketingSection">
          <div className="sectionBadge">Features</div>
          <h2>Everything around the canvas feels intentional.</h2>
          <p className="sectionLead">
            The website and editor share one language: deep dark surfaces, colored glow,
            soft glass panels and a workflow that does not get in the way.
          </p>

          <div className="marketingFeatureGrid">
            {featureCards.map((feature) => (
              <article className="marketingFeatureCard" key={feature.title}>
                <div className="featureIcon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="marketingSplitSection">
          <div className="workflowCopy">
            <div className="sectionBadge">Workflow</div>
            <h2>Landing page, account, project shelf, editor. One clean path.</h2>
            <p>
              Get started opens authentication. After login, the user enters a project
              collection where every concept can be named, described and reopened.
              Then the editor starts with the selected project.
            </p>

            <div className="workflowSteps">
              <div><strong>01</strong><span>Open ORIX</span></div>
              <div><strong>02</strong><span>Sign in or create account</span></div>
              <div><strong>03</strong><span>Create a project</span></div>
              <div><strong>04</strong><span>Design and export</span></div>
            </div>
          </div>

          <div id="projects" className="workflowBoard glassSoftPanel">
            <div className="workflowBoardHeader">
              <span>Project library</span>
              <button type="button" onClick={onGetStarted}>+ New</button>
            </div>

            <div className="miniProjectCards">
              <article>
                <h4>Landing — Product launch</h4>
                <p>Hero, pricing, footer</p>
              </article>
              <article>
                <h4>Dashboard — Analytics</h4>
                <p>Cards, stats, navigation</p>
              </article>
              <article>
                <h4>Mobile onboarding</h4>
                <p>Frames and reusable controls</p>
              </article>
            </div>
          </div>
        </section>

        <section className="marketingPricingMood">
          <div className="pricingMoodCard">
            <h3>Structure before export</h3>
            <p>Headers, nav buttons, CTA blocks and cards can carry semantic metadata.</p>
          </div>
          <div className="pricingMoodCard featured">
            <h3>Design in ORIX</h3>
            <p>Build scenes with a focused editor experience and a project-first entry flow.</p>
          </div>
          <div className="pricingMoodCard">
            <h3>Iterate confidently</h3>
            <p>Keep multiple concepts in the dashboard and return to them in one click.</p>
          </div>
        </section>

        <section id="start" className="marketingFinalCta glassShowcase">
          <div className="ctaOrb" />
          <BrandLogo />
          <h2>Step into a cleaner design workflow.</h2>
          <p>Create an account, start a project and open the ORIX editor.</p>
          <button className="marketingPrimaryBtn large" type="button" onClick={onGetStarted}>
            Get started
          </button>
        </section>
      </main>

      <footer className="marketingFooter">
        <BrandLogo compact />
        <p>ORIX concept site for the editor project. Built in the same glassmorphism style.</p>
        <div className="footerLinks">
          <button type="button" onClick={onLogin}>Log in</button>
          <button type="button" onClick={onGetStarted}>Create account</button>
          <button type="button" onClick={onProjects}>Projects</button>
        </div>
      </footer>
    </div>
  );
}
