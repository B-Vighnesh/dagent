import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Layout from '../components/Layout.jsx';
import ScanPreview from '../components/ScanPreview.jsx';
import { about, datasetFacts, patternTypes, pipeline, privacyPrinciples, projectStatus, roadmap, steps } from '../data/content.js';
import { ArrowRight } from "lucide-react";

function Hero() {
  return (
    <section className="hero">
      <div className="shell hero-grid">
        <div>
          <p className="eyebrow">
            DARK PATTERN DETECTOR <i>o</i> PROJECT DEMO
          </p>
          <h1>
            Spot the manipulation.
            <br />
            <em>Choose freely.</em>
          </h1>
          <p className="lead">
            DAGENT explores how a browser tool could help people notice
            deceptive design patterns and make informed choices. The scan on
            this site is a demo with prepared examples.
          </p>

          <div className="actions">
            <Link className="button primary" to="/scan">
              Try the demo <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
            </Link>
            <Link className="button ghost" to="/download">
              Get the extension <Icon>down</Icon>
            </Link>
          </div>

          <div className="metrics">
            <div>
              <b>7</b>
              <span>Pattern categories detected</span>
            </div>
            <div>
              <b>2</b>
              <span>Stage detection pipeline</span>
            </div>
            
          </div>
        </div>

        <ScanPreview />
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="section muted">
      <div className="shell">
        <p className="eyebrow">{about.eyebrow}</p>
        <h2>{about.title}</h2>
        <p className="section-lead">{about.lead}</p>

        <div className="about-grid">
          {about.points.map((point) => (
            <div className="about-point" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </div>
          ))}
        </div>

        <div className="solution-card">
          <p className="eyebrow">{about.solution.eyebrow}</p>
          <h3>{about.solution.title}</h3>
          <p>{about.solution.body}</p>
        </div>
      </div>
    </section>
  );
}

function ProjectStatus() {
  return (
    <section className="section project-status">
      <div className="shell">
        <p className="eyebrow">WHERE THE PROJECT STANDS</p>
        <h2>A working idea, still in progress.</h2>
        <p className="section-lead">
          The website lets you explore the concept. The detector is not hosted: the models are large, hosting needs funding, and our goal is to keep page text on your device.
        </p>
        <div className="project-grid">
          {projectStatus.map((item) => (
            <article className="project-card" key={item.label}>
              <span className="project-label">{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="section muted privacy-section">
      <div className="shell">
        <p className="eyebrow">PRIVACY IS A DESIGN RULE</p>
        <h2>Page text should stay yours.</h2>
        <p className="section-lead">
          The current website is a static demo. For a future release, Dagent is designed around local detection, minimal storage, and no third-party AI calls.
        </p>
        <div className="about-grid">
          {privacyPrinciples.map((item) => (
            <article className="about-point" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DatasetSection() {
  return (
    <section className="section dataset-section">
      <div className="shell dataset-layout">
        <div>
          <p className="eyebrow">BUILT FROM EXAMPLES</p>
          <h2>Learning to recognize the language.</h2>
          <p className="section-lead">
            The training set combines labelled examples from different pages. The two classifier stages first look for a possible pattern, then predict its category.
          </p>
          <p className="dataset-note">
            Categories with few examples, such as Forced Action, may be less reliable. A model prediction is a prompt to look closer, not a final judgment.
          </p>
        </div>
        <div className="dataset-facts">
          {datasetFacts.map(([value, label]) => (
            <div className="dataset-fact" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PatternGrid() {
  return (
    <section id="overview" className="section">
      <div className="shell">
        <p className="eyebrow">EXAMPLES &amp; CATEGORIES</p>
        <h2>
          Dark patterns hide in
          <br />
          plain sight.
        </h2>
        <p className="section-lead">
          Real examples from our training dataset, grouped by category and
          the kind of app they usually show up in.
        </p>

        <div className="pattern-grid">
          {patternTypes.map((pattern) => (
            <article className={`pattern ${pattern.tone}`} key={pattern.number}>
              <div className="pattern-head">
                <span className="number">{pattern.number}</span>
                <span className="context-tag">{pattern.context}</span>
              </div>
              <h3>{pattern.title}</h3>
              <p>{pattern.definition}</p>
              <ul className="pattern-examples">
                {pattern.examples.map((example) => (
                  <li key={example}>&ldquo;{example}&rdquo;</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pipeline() {
  const [capture, stage1, stage2] = pipeline;

  return (
    <section id="pipeline" className="section muted">
      <div className="shell">
        <p className="eyebrow">HOW DETECTION ACTUALLY WORKS</p>
        <h2>
          Two stages to
          <br />
          narrow it down.
        </h2>
        <p className="section-lead">
          In the local prototype, text is split into sentences, screened for possible patterns, then assigned a likely category. No LLM is required for this two-model pipeline.
        </p>

        <div className="pipeline">
          <div className="pipeline-node">
            <span className="pipeline-stage">{capture.stage}</span>
            <h3>{capture.title}</h3>
            <p>{capture.body}</p>
          </div>

          <div className="pipeline-arrow">
            <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
          </div>

          <div className="pipeline-node">
            <span className="pipeline-stage">{stage1.stage}</span>
            <h3>{stage1.title}</h3>
            <p>{stage1.body}</p>
            <div className="verdict green">
              <div>
                <b>{stage1.outcome.label}</b>
                <small>{stage1.outcome.note}</small>
              </div>
            </div>
          </div>

          <div className="pipeline-arrow">
            <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
          </div>

          <div className="pipeline-node wide">
            <span className="pipeline-stage">{stage2.stage}</span>
            <h3>{stage2.title}</h3>
            <p>{stage2.body}</p>
            <div className="verdict-grid">
              {stage2.branches.map((branch) => (
                <div className={`verdict ${branch.popup}`} key={branch.label}>
                  <div>
                    <b>{branch.label}</b>
                    <small>{branch.note}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Roadmap() {
  return (
    <section id="roadmap" className="section">
      <div className="shell">
        <div className="roadmap-card">
          <p className="eyebrow">{roadmap.eyebrow}</p>
          <h2>{roadmap.title}</h2>
          <p>{roadmap.body}</p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="section muted">
      <div className="shell split">
        <div>
          <p className="eyebrow">USING THE EXTENSION</p>
          <h2>From a demo to an on-device tool.</h2>
        </div>

        <ol className="steps">
          {steps.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="cta">
      <div className="shell">
        <p className="eyebrow">READY TO LOOK CLOSER?</p>
        <h2>
          The web should work
          <br />
          <em>for you.</em>
        </h2>
        <div className="cta-actions">
          <Link className="button primary" to="/scan">
            Live demo <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
          </Link>
          <Link className="button ghost light" to="/download">
            Get the extension <Icon>
  <ArrowRight size={10} strokeWidth={1.5} />
</Icon>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <Layout>
      <Hero />
      <AboutSection />
      <ProjectStatus />
      <PatternGrid />
      <DatasetSection />
      <Pipeline />
      <PrivacySection />
      <HowItWorks />
      <Cta />
      <Roadmap />
    </Layout>
  );
}

