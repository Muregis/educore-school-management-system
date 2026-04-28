import PropTypes from "prop-types";

/**
 * Reusable Print Header component for school documents
 * Displays school logo, name, motto, and contact details
 * 
 * Usage: <PrintHeader school={school} branding={branding} />
 * 
 * @param {Object} props
 * @param {Object} props.school - School object with name, logo_url, motto, etc.
 * @param {Object} props.branding - Optional branding object from backend (report cards endpoint)
 * @param {string} props.title - Optional document title to display
 */
export default function PrintHeader({ school, branding, title }) {
  // Use branding data if provided (from report cards endpoint), otherwise fall back to school prop
  const logoUrl = branding?.logoUrl || school?.logo_url || school?.logoUrl || "";
  const schoolName = branding?.schoolName || school?.name || school?.school_name || "School";
  const motto = branding?.schoolMotto || school?.motto || school?.tagline || "";
  const address = branding?.schoolAddress || school?.address || "";
  const phone = branding?.schoolPhone || school?.phone || "";
  const email = branding?.schoolEmail || school?.email || "";

  const hasContactDetails = address || phone || email;

  return (
    <div className="print-header">
      <div className="print-header-content">
        {/* Logo - left aligned */}
        {logoUrl && (
          <div className="print-header-logo">
            <img 
              src={logoUrl} 
              alt={`${schoolName} logo`}
              onError={(e) => {
                // Hide logo on error without breaking layout
                e.target.style.display = "none";
              }}
            />
          </div>
        )}
        
        {/* School info - centered or takes remaining space */}
        <div className={`print-header-info ${!logoUrl ? "print-header-info-full" : ""}`}>
          <h1 className="print-header-school-name">{schoolName}</h1>
          {motto && <p className="print-header-motto">{motto}</p>}
          {hasContactDetails && (
            <div className="print-header-contact">
              {address && <span>{address}</span>}
              {phone && <span>{phone}</span>}
              {email && <span>{email}</span>}
            </div>
          )}
        </div>
      </div>
      
      {title && <div className="print-header-title">{title}</div>}
      
      <div className="print-header-divider" />
    </div>
  );
}

PrintHeader.propTypes = {
  school: PropTypes.shape({
    name: PropTypes.string,
    school_name: PropTypes.string,
    logo_url: PropTypes.string,
    logoUrl: PropTypes.string,
    motto: PropTypes.string,
    tagline: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
  }),
  branding: PropTypes.shape({
    logoUrl: PropTypes.string,
    schoolName: PropTypes.string,
    schoolMotto: PropTypes.string,
    schoolAddress: PropTypes.string,
    schoolPhone: PropTypes.string,
    schoolEmail: PropTypes.string,
  }),
  title: PropTypes.string,
};

PrintHeader.defaultProps = {
  school: {},
  branding: null,
  title: "",
};
