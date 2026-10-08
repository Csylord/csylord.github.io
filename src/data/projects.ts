import type { Project } from '../types';
import { placeholder } from '../data/placeholders.ts';

export const projects: Project[] = [
    {
        images: [placeholder(1), placeholder(2), placeholder(3)],
        title: 'Project One',
        role: 'Sole Developer & Designer',
        tools: ["Unity", "C#", "Blender", "Photoshop"],
        description: 'A 3D platformer game developed using Unity, featuring unique mechanics and immersive environments.',
        link: 'https://csylord.itch.io/project-one',
    },
    {
        images: [placeholder(4), placeholder(5), placeholder(6)],
        title: 'Project Two',
        role: 'Sole Developer & Designer',
        tools: ["Unity", "C#", "Blender", "Photoshop"],
        description: 'A 3D platformer game developed using Unity, featuring unique mechanics and immersive environments.',
        link: 'https://csylord.itch.io/project-one',
    },
];