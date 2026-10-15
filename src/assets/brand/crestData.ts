/**
 * Official University of Lakki Marwat Crest Brand Module
 * Completely offline - zero external network requests.
 * Uses exact supplied PNG assets preserved at 100% fidelity.
 */
import { 
  ULM_CREST_SRC, 
  ULM_CREST_LOGO_SRC, 
  ULM_CREST_WATERMARK_SRC, 
  ULM_CREST_LOGO_FILE, 
  ULM_CREST_WATERMARK_FILE 
} from '../ulmCrest';

export { 
  ULM_CREST_SRC, 
  ULM_CREST_LOGO_SRC, 
  ULM_CREST_WATERMARK_SRC, 
  ULM_CREST_LOGO_FILE, 
  ULM_CREST_WATERMARK_FILE 
};

// Aliases matching user filenames
export const ULM_LIBRARY_LOGO_SRC = ULM_CREST_LOGO_SRC;
export const ULM_LIBRARY_WATERMARK_SRC = ULM_CREST_WATERMARK_SRC;
export const ULM_LIBRARY_LOGO_FILE = '/ulm_library_logo.png';
export const ULM_LIBRARY_WATERMARK_FILE = '/ulm_library_watermark_6pct.png';

export const ULM_UNIVERSITY_CREST_SRC = ULM_CREST_LOGO_SRC;
export const ULM_UNIVERSITY_CREST_WATERMARK_SRC = ULM_CREST_WATERMARK_SRC;

export const ULM_CREST_WATERMARK_URI = ULM_CREST_WATERMARK_SRC;
export default ULM_CREST_SRC;
