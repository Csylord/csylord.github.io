import { socials } from "../data/socials";

export function SocialButtons() {
  return (
    <div className="socials">
      {socials.map((social) => {
        const Icon = social.icon;
        return (
          <a
            key={social.label}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            <Icon aria-hidden="true" />
            {social.label}
          </a>
        );
      })}
    </div>
  );
}