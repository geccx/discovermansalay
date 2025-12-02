import React from 'react';
import NavbarCMS from './ContentManagement/NavbarCMS';
import HeroCMS from './ContentManagement/HeroCMS';
import ExploreCMS from './ContentManagement/ExploreCMS';
import HighlightEventsCMS from './ContentManagement/HighlightEventsCMS';
import ExperienceCMS from './ContentManagement/ExperienceCMS';


const ContentManagement = ({ activeSubMenu }) => {
  return (
    <div className="content-management-wrapper">
      <div className="submenu-content">
        {activeSubMenu === 'Logo' && <NavbarCMS />}
        {activeSubMenu === 'Background' && <HeroCMS />}
        {activeSubMenu === 'Top Destinations' && <ExploreCMS />}
        {activeSubMenu === 'Highlight Events' && <HighlightEventsCMS />}
        {activeSubMenu === 'Experience Mansalay' && <ExperienceCMS />}
      </div>
    </div>
  );
};

export default ContentManagement;
