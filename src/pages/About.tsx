import { SocialButtons } from "../components/SocialButtons";

export function About() {
  return (
    <section id="about">
      <h1>About Me</h1>
      <div className="about-grid">
        <p className="lead">
          TBA
        </p>
        <div className="panel">
          <h3>Find me online</h3>
          <SocialButtons />
        </div>
      </div>
    </section>
  );
}