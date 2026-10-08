import { SocialButtons } from "../components/SocialButtons";

export function About() {
  return (
    <section id="about">
      <h1>About Me</h1>
      <div className="about-grid">
        <p className="lead">
          Welcome to my portfolio! My name is Liam, and I have always had a passion for creating fun experiences. From a young age, I started playing with Lego and Hot Wheels, creating imaginary films; and now, I'm still doing the same thing! (Just with Game Engines instead..) 
        </p>
        <p>
          My journey through life has always had one goal, to make games. Since I was old enough to hold a controller, I have been playing games, this led me to now! I left school and joined college and much to my parents' dismay, decided to chose a college which was almost an hour away, just to pursue my interest in Games Development. I left college with a Distinction* in Games Technology and recieved the local "Game of the Year" award and came second in the National Game Awards. This brings us to now, where I am currently studying at the University of Lincoln, in my second year of a Games Development degree. 
        </p>
        <p>
          Not only have I focused on my education, I also have gotten handy work experience in all of the usual places someone my age would! I've worked at the local Chippy, to a Hotel which served RAF and USAF members, to a luxury Lodge Resort, which housed celebrities such as the Womens England Football Team. I have also done a short amount of work experience at Ghost Games, doing a week of research and development and getting my first real taste of the industry.  
        </p>
        <p>
          Whilst I have prioritsed my education and work experience, I believe the most important thing is to have fun! Make friends along the way and enjoy the journey. I have always been quite a social person, and I have made many friends along the way, some of which I still keep in contact with to this day. 
        </p>
        <div className="panel">
          <h3>Find me in other places!</h3>
          <SocialButtons />
        </div>
      </div>
    </section>
  );
}