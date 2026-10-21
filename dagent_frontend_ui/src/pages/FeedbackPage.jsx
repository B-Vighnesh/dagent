import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Layout from '../components/Layout.jsx';

const contactMethods = [
  {
    icon: '@',
    label: 'Email us',
    value: 'bvighneshkumar@gmail.com',
    href: 'mailto:bvighneshkumar@gmail.com',
  },
  {
    icon: '@',
    label: 'Email',
    value: 'vighneshsheregar2004@gmail.com',
    href: 'mailto:vighneshsheregar2004@gmail.com',
  },
  {
    icon: 't',
    label: 'Phone',
    value: '+91 86184 02581',
    href: 'tel:+918618402581',
  },
  {
    icon: 't',
    label: 'Response time',
    value: 'Every report reviewed within 48 hours',
  },
];

const trustPoints = [
  ['Free', 'to reach us'],
  ['48h', 'avg. response'],
  ['100%', 'reports reviewed'],
];

const typeOptions = [
  { id: 'pattern', label: 'A dark pattern we missed', placeholder: 'Describe what you saw, and on which page...' },
  { id: 'idea', label: 'Feedback or an idea', placeholder: 'Share your feedback or idea...' },
  { id: 'other', label: 'Others', placeholder: 'Tell us what\u2019s on your mind...' },
];

export default function FeedbackPage() {
  const [sent, setSent] = useState(false);
  const [type, setType] = useState('pattern');
  const current = typeOptions.find((option) => option.id === type);

  function handleSubmit(event) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <Layout>
      <section className="plain-page">
        <div className="shell feedback">
          <div>
            <p className="eyebrow">GET IN TOUCH</p>
            <h1>Help make the web<br /><em>more honest.</em></h1>
            <p className="lead">Seen a pattern we missed, have a question, or want to share an idea? Reach out however works best for you.</p>

            <div className="contact-list">
              {contactMethods.map((method) => (
                <div className="contact-item" key={method.label}>
                  <span>
                    <strong>{method.label}</strong>
                    {method.href ? <a className="contact-value" href={method.href}>{method.value}</a> : <small>{method.value}</small>}
                  </span>
                </div>
              ))}
            </div>

            
          </div>
          <div className="form-card">
            {sent ? <div className="success"><b>OK</b><h2>Report received.</h2><p>Thanks for helping us build a more transparent web.</p><button className="button primary" type="button" onClick={() => setSent(false)}>Send another report</button></div> : (
              <form onSubmit={handleSubmit}>
                <label>What would you like to share?</label>
                <div className="choice">
                  {typeOptions.map((option) => (
                    <button type="button" key={option.id} className={type === option.id ? 'chosen' : ''} onClick={() => setType(option.id)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {type === 'pattern' && (
                  <>
                    <label htmlFor="site">Website URL <small>Optional</small></label>
                    <input id="site" type="url" placeholder="https://example.com" />
                  </>
                )}
                <label htmlFor="message">Tell us more</label>
                <textarea id="message" rows="5" required placeholder={current.placeholder} />
                <label htmlFor="email">Your email <small>Optional</small></label>
                <input id="email" type="email" placeholder="you@example.com" />
                <button className="button primary wide">Submit report <Icon>-&gt;</Icon></button>
                <small className="privacy">Your information is only used to follow up on this report.</small>
              </form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
