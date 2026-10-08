import type { Project } from '../types';

export function ProjectCard({ project }: { project: Project }) {
    return (
        <article className="card">
            <h3>{project.title}</h3>
            <p className="role">{project.role}</p>
            <p>{project.description}</p>
            <a href={project.link} target="_blank" rel="noreferrer" className="btn">
                View project <span aria-hidden="true">↗</span>
            </a>
        </article>
    );
}