export default function InstituteLogos({compact=false}:{compact?:boolean}){
 return <div className={compact?'institutelogos compact':'institutelogos'} aria-label="IIT Madras and ILCE">
  <img src="/logos/iitm.png" alt="Indian Institute of Technology Madras" width={148} height={48}/>
  <img src="/logos/ilce.jpg" alt="Institute for Lean Construction Excellence" width={140} height={48}/>
 </div>;
}
