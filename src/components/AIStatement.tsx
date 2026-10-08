export function AIStatement() {
  return (
    <section id="ai">
      <h2>How I Used AI</h2>
      <p>
        I built this site with React, TypeScript and Vite, using Claude (Anthropic's AI assistant) as a tutor and pair-programmer. I had not covered React on my course yet, so I used AI to learn as I built: I asked it to explain each file and concept, then changed the code myself to check I understood it.
      </p>
      <ul>
        <li>
          <strong>Where AI helped:</strong> walking me through project setup and GitHub Pages deployment, writing starter code for the components, the scroll-tracking navbar and the fade-in effect, and explaining errors and CSS concepts.
        </li>
        <li>
          <strong>What I did myself:</strong> the concept and visual direction, all of the content (projects, about me, links), and design decisions such as moving from separate pages to a single scrolling page. 
        </li>
        <li>
          <strong>Problems I debugged:</strong> PowerShell blocking npm scripts, Git rejecting my first push because GitHub already had a README my local project lacked, and a blank live site caused by GitHub Pages publishing raw source files before it was switched to GitHub Actions. I fixed it by checking the setting and re-running the workflow.
        </li>
        <li>
          <strong>Where the AI steered me wrong:</strong> its early instructions had me create the repo with a README and use branch-based Pages deployment, which conflicted with the Actions-based deployment I needed later. I had to work out the mismatch and correct it.
        </li>
        <li>
          <strong>What I learned:</strong> how typed data flows from an interface into reusable components, how CSS variables control a whole theme, and how IntersectionObserver powers scroll effects.
        </li>
      </ul>
      <p>
        I treat AI output as a draft: I read it, test it, and make sure I can explain how it works.
      </p>
    </section>
  );
}