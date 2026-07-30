import b2bMascot from '../assets/mascots/b2b.png';
import businessMascot from '../assets/mascots/business.png';
import businessTransformationMascot from '../assets/mascots/business-transformation.png';
import engineeringMascot from '../assets/mascots/engineering.png';
import factoryDevelopmentMascot from '../assets/mascots/factory-development.png';
import fineArtsMascot from '../assets/mascots/fine-arts.png';
import operationAcademicMascot from '../assets/mascots/operation-academic.png';
import professionalDevelopmentMascot from '../assets/mascots/professional-development.png';
import saberMascot from '../assets/mascots/saber.png';
import serviceMascot from '../assets/mascots/service.png';
import socialProjectionMascot from '../assets/mascots/social-projection.png';
import specializationsMascot from '../assets/mascots/specializations.png';
import transversalMascot from '../assets/mascots/transversal.png';

export const AREA_VISUALS = {
  1: { color: '#29366f', mascot: operationAcademicMascot },
  2: { color: '#43b8bf', contrast: '#073b3e', mascot: factoryDevelopmentMascot },
  3: { color: '#970b12', mascot: specializationsMascot },
  4: { color: '#c5102e', mascot: b2bMascot },
  5: { color: '#c51a78', mascot: serviceMascot },
  6: { color: '#70b52b', contrast: '#17370a', mascot: saberMascot },
  7: { color: '#08743e', mascot: socialProjectionMascot },
  8: { color: '#9f559b', mascot: professionalDevelopmentMascot },
};

export const OPERATION_VISUALS = {
  general: { color: '#29366f', mascot: operationAcademicMascot },
  1: { color: '#684098', mascot: fineArtsMascot },
  2: { color: '#f2a51f', contrast: '#4a2b00', mascot: transversalMascot },
  3: { color: '#52077c', mascot: businessTransformationMascot },
  4: { color: '#c84d32', mascot: businessMascot },
  5: { color: '#c65a00', mascot: engineeringMascot },
};
