import { SocialButtons } from "../components/SocialButtons";

const facts = [
  { label: "Current Study", value: "Games Development, University of Lincoln (2nd year)" },
  { label: "Previous Qualification", value: "Distinction* in Games Technology at College; Grade 5 in Maths & English and a Grade 8 in Photography at a GCSE level." },
  { label: "Awards", value: "1st place @ Local Game of the Year; 2nd place @ National Game Awards" },
];

export function About() {
  return (
    <section id="about">
      <h2>About Me</h2>
      <div className="about-grid">
        <div className="about-text">
          <p className="lead">
            Welcome to my portfolio! My name is Liam, and I have always had a
            passion for creating fun experiences. From a young age I played
            with Lego and Hot Wheels, making up imaginary films, and now I am
            still doing the same thing, just with game engines instead!
          </p>
          <p>
            My journey has always had one goal: to make games. Since I was old
            enough to hold a controller I have been playing them, and that led
            me here. After school, much to my parents' dismay, I chose a
            college almost an hour away just to pursue Games Development. I
            left with a Distinction* in Games Technology, received the local
            "Game of the Year" award, and came second in the National Game
            Awards.
          </p>
          <p>
            I am now in my second year of a Games Development degree at the
            University of Lincoln. Alongside my studies I have gained plenty
            of work experience, from the local chippy to a hotel serving RAF
            and USAF members and a luxury lodge resort that hosted celebrities
            such as the Women's England Football Team. I have also spent a
            week at Ghost Games on research and development, my first real
            taste of the industry.
          </p>
          <p>
            While I have prioritised my education and work experience, I
            believe the most important thing is to have fun, make friends
            along the way, and enjoy the journey. 
          </p>
        </div>

        <aside className="about-side">
          <div className="panel">
            <h3>At a glance</h3>
            <dl className="facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="panel">
            <h3>Find me in other places!</h3>
            <SocialButtons />
          </div>
        </aside>
      </div>
    </section>
  );
}