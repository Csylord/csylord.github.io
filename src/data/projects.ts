import type { Project } from '../types';
import { placeholder } from '../data/placeholders.ts';

export const projects: Project[] = [
    {
        images: [
            { src: placeholder(1), alt: 'Project One Image 1' },
            { src: placeholder(2), alt: 'Project One Image 2' },
            { src: placeholder(3), alt: 'Project One Image 3' },
        ],
        title: 'Project One',
        role: 'Sole Developer & Designer',
        tools: ["Unity", "C#", "Blender", "Photoshop"],
        description: 'A 3D platformer game developed using Unity, featuring unique mechanics and immersive environments.',
        link: 'https://csylord.itch.io/project-one',
    },
    {
        images: [
            { src: placeholder(4), alt: 'Project Two Image 4' },
            { src: placeholder(5), alt: 'Project Two Image 5' },
            { src: placeholder(6), alt: 'Project Two Image 6' },
        ],
        title: 'Project Two',
        role: 'Sole Developer & Designer',
        tools: ["Unity", "C#", "Blender", "Photoshop"],
        description: 'A 3D platformer game developed using Unity, featuring unique mechanics and immersive environments.',
        link: 'https://csylord.itch.io/project-one',
    },
];