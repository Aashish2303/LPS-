export default function InstituteLogos({compact=false}:{compact?:boolean}){
 return <div className={compact?'institutelogos compact':'institutelogos'} aria-label="IIT Madras and ILCE">
  <img className="iitmemblem" src="/logos/iitm.svg" alt="IIT Madras emblem" width={112} height={112}/>
  <img src="/logos/ilce.jpg" alt="Institute for Lean Construction Excellence" width={199} height={68}/>
 </div>;
}
