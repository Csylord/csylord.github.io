import { projects } from '../data/projects';
import { ProjectCard } from '../components/ProjectCard';
import { Reveal } from '../components/Reveal';

export function Projects() {
    return (
        <section id ="projects">
            <h1>Projects</h1>
            <div className="grid">
                {projects.map((project, index) => (
                    <Reveal key={project.title} delay={index * 100}>
                        <ProjectCard project={project} />
                    </Reveal>
                    ))}
            </div>
        </section>
    );
}