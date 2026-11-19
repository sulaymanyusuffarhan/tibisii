export const PUBLIC_FORM_TYPES = {
 general_enquiry:{prefix:'TBC-GEN',sw:'Ulizo la jumla',en:'General enquiry',introSw:'Uliza swali kuhusu taasisi, maudhui au huduma.',introEn:'Ask a question about the institution, its content or services.'},
 contact:{prefix:'TBC-CNT',sw:'Wasiliana nasi',en:'Contact us',introSw:'Tuma ujumbe wa mawasiliano kwa TBC. Maelezo yako yatahifadhiwa kwa usalama.',introEn:'Send a message to TBC. Your details will be stored securely.'},
 stakeholder_feedback:{prefix:'TBC-FDB',sw:'Maoni ya wadau',en:'Stakeholder feedback',introSw:'Shiriki maoni yako kuhusu mawasiliano na taarifa za taasisi.',introEn:'Share feedback about institutional communications and information.'},
 testimonial:{prefix:'TBC-TST',sw:'Ushuhuda wa mdau',en:'Stakeholder testimonial',introSw:'Wasilisha ushuhuda. Hautachapishwa bila ukaguzi na idhini ya TBC.',introEn:'Submit a testimonial. It will not be published without TBC review and approval.'},
 partnership_inquiry:{prefix:'TBC-PRT',sw:'Ombi la ushirikiano',en:'Partnership enquiry',introSw:'Uliza kuhusu uwezekano wa ushirikiano wa kitaasisi.',introEn:'Enquire about a potential institutional partnership.'},
 sponsorship_inquiry:{prefix:'TBC-SPN',sw:'Udhamini na matangazo',en:'Sponsorship and advertising',introSw:'Tuma swali kuhusu udhamini au matangazo. Viwango havijaahidiwa na fomu hii.',introEn:'Ask about sponsorship or advertising. This form does not promise rates or placement.'},
 production_inquiry:{prefix:'TBC-PRD',sw:'Uzalishaji wa vipindi',en:'Programme production',introSw:'Uliza kuhusu uwezekano wa uzalishaji au ushirikiano wa vipindi.',introEn:'Enquire about programme production or collaboration.'},
 media_inquiry:{prefix:'TBC-MED',sw:'Ulizo la vyombo vya habari',en:'Media enquiry',introSw:'Wasilisha ulizo la kitaaluma la vyombo vya habari.',introEn:'Submit a professional media enquiry.'},
 regional_office_enquiry:{prefix:'TBC-REG',sw:'Ulizo kwa ofisi ya kanda',en:'Regional office enquiry',introSw:'Eleza mkoa au eneo linalohusika. Anwani na mawasiliano ya ofisi huonyeshwa tu baada ya kuthibitishwa.',introEn:'Mention the relevant region. Office contact details are shown only after verification.'},
} as const;
export type PublicFormType=keyof typeof PUBLIC_FORM_TYPES;
export function isPublicFormType(value:string):value is PublicFormType{return Object.prototype.hasOwnProperty.call(PUBLIC_FORM_TYPES,value)}
