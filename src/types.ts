export interface Project {
    title: string;
    role: string;
    tools: string[];
    description: string;
    link: string;
    images: ProjectImage[];
}

export interface ProjectImage {
  src: string;
  alt: string;
}