export default function InstituteLogos({compact=false}:{compact?:boolean}){
 return <div className={compact?'institutelogos compact':'institutelogos'} aria-label="IIT Madras and ILCE">
  <img src="/logos/iitm.png" alt="Indian Institute of Technology Madras" width={272} height={60}/>
  <img src="/logos/ilce.jpg" alt="Institute for Lean Construction Excellence" width={199} height={68}/>
 </div>;
}
