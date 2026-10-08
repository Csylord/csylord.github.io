import type { IconType } from "react-icons";
import { FaGithub, FaLinkedin, FaItchIo, FaSteam } from "react-icons/fa";

export interface SocialLink {
  label: string;
  url: string;
  icon: IconType;
}

export const socials: SocialLink[] = [
  { label: "GitHub", url: "https://github.com/csylord", icon: FaGithub },
  { label: "LinkedIn", url: "https://linkedin.com/in/liam-walke-7153b1338", icon: FaLinkedin },
  { label: "Itch.io", url: "https://csylord.itch.io/", icon: FaItchIo },
  { label: "Steam", url: "https://steamcommunity.com/id/csylord/", icon: FaSteam },
];