import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import SearchBar from '../components/SearchBar'; 
import Explore from '../components/Explore';
import HighlightEvents from '../components/HighlightEvents';
import Experience from '../components/Experience';
import Footer from '../components/Footer';
import '../styles/pages.css';


function Home() {
  return (
    <div>
      <Navbar />
      <Hero />
      <SearchBar />
      <Explore/>
      <HighlightEvents/>
      <Experience/>
      <Footer/>
    </div>
  );
}

export default Home;
