import { socials } from "../data/socials";

export function SocialButtons() {
  return (
    <div className="socials">
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          {social.label} <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}