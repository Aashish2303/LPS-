export default function InstituteLogos({compact=false}:{compact?:boolean}){
 return <div className={compact?'institutelogos compact':'institutelogos'} aria-label="IIT Madras and ILCE">
  <svg className="iitmemblem" viewBox="0 0 60 60" width={112} height={112} role="img" aria-label="IIT Madras emblem">
   <image href="/logos/iitm.png" width={272} height={60}/>
  </svg>
  <img src="/logos/ilce.jpg" alt="Institute for Lean Construction Excellence" width={199} height={68}/>
 </div>;
}
