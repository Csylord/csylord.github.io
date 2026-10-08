import { projects } from '../data/projects';
import { ProjectCard } from '../components/ProjectCard';

export function Projects() {
    return (
        <section>
            <h1>Projects</h1>
            <div className="grid">
                {projects.map((project) => (
                    <ProjectCard key={project.title} project={project} />
                ))}
            </div>
        </section>
    );
}