import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MASTER_REGISTRY = [
    { name: 'All India Quota (MCC)', type: 'CENTRAL', authorityName: 'Medical Counselling Committee (MCC)', primaryWebsite: 'https://mcc.nic.in/' },
    { name: 'AYUSH (AACCC)', type: 'CENTRAL', authorityName: 'Ayush Admissions Central Counseling Committee', primaryWebsite: 'https://aaccc.gov.in/' },
    { name: 'Andaman & Nicobar', type: 'UT', authorityName: 'Andaman & Nicobar Islands Institute of Medical Sciences (ANIIMS)', primaryWebsite: 'http://andssw1.and.nic.in/aniims/' },
    { name: 'Andhra Pradesh', type: 'STATE', authorityName: 'Dr. YSR University of Health Sciences', primaryWebsite: 'http://ntruhs.ap.nic.in/' },
    { name: 'Arunachal Pradesh', type: 'STATE', authorityName: 'Directorate of Higher and Technical Education (DHTE)', primaryWebsite: 'https://apdhte.nic.in/' },
    { name: 'Assam', type: 'STATE', authorityName: 'Directorate of Medical Education (DME) Assam', primaryWebsite: 'https://dme.assam.gov.in/' },
    { name: 'Bihar', type: 'STATE', authorityName: 'Bihar Combined Entrance Competitive Examination Board (BCECEB)', primaryWebsite: 'https://bceceboard.bihar.gov.in/' },
    { name: 'Chandigarh', type: 'UT', authorityName: 'Government Medical College & Hospital (GMCH)', primaryWebsite: 'https://gmch.gov.in/' },
    { name: 'Chhattisgarh', type: 'STATE', authorityName: 'Directorate of Medical Education (CGDME)', primaryWebsite: 'https://cgdme.in/' },
    { name: 'Dadra & Nagar Haveli and Daman & Diu', type: 'UT', authorityName: 'Directorate of Medical & Health Services', primaryWebsite: 'https://daman.nic.in/' },
    { name: 'Delhi', type: 'UT', authorityName: 'Faculty of Medical Sciences (DU) & GGSIPU', primaryWebsite: 'http://fmsc.ac.in/' },
    { name: 'Goa', type: 'STATE', authorityName: 'Directorate of Technical Education (DTE) Goa', primaryWebsite: 'https://dte.goa.gov.in/' },
    { name: 'Gujarat', type: 'STATE', authorityName: 'Admission Committee for Professional Undergraduate Medical Educational Courses (ACPUGMEC)', primaryWebsite: 'http://medadmgujarat.org/' },
    { name: 'Haryana', type: 'STATE', authorityName: 'Department of Medical Education and Research (DMER) Haryana', primaryWebsite: 'https://uhsrugcounselling.com/' },
    { name: 'Himachal Pradesh', type: 'STATE', authorityName: 'Atal Medical & Research University (AMRU)', primaryWebsite: 'https://amruhp.ac.in/' },
    { name: 'Jammu & Kashmir', type: 'UT', authorityName: 'J&K Board of Professional Entrance Examinations (BOPEE)', primaryWebsite: 'https://jkbopee.gov.in/' },
    { name: 'Jharkhand', type: 'STATE', authorityName: 'Jharkhand Combined Entrance Competitive Examination Board (JCECEB)', primaryWebsite: 'https://jceceb.jharkhand.gov.in/' },
    { name: 'Karnataka', type: 'STATE', authorityName: 'Karnataka Examinations Authority (KEA)', primaryWebsite: 'https://cetonline.karnataka.gov.in/kea/' },
    { name: 'Kerala', type: 'STATE', authorityName: 'Commissioner for Entrance Examinations (CEE) Kerala', primaryWebsite: 'https://cee.kerala.gov.in/' },
    { name: 'Ladakh', type: 'UT', authorityName: 'Directorate of Health Services, Ladakh', primaryWebsite: 'https://health.ladakh.gov.in/' },
    { name: 'Lakshadweep', type: 'UT', authorityName: 'Department of Education, Lakshadweep', primaryWebsite: 'https://lakshadweep.gov.in/' },
    { name: 'Madhya Pradesh', type: 'STATE', authorityName: 'Department of Medical Education (DME) MP', primaryWebsite: 'https://dme.mponline.gov.in/' },
    { name: 'Maharashtra', type: 'STATE', authorityName: 'State Common Entrance Test Cell (CET Cell) Maharashtra', primaryWebsite: 'https://cetcell.mahacet.org/' },
    { name: 'Manipur', type: 'STATE', authorityName: 'Directorate of Health Services Manipur', primaryWebsite: 'http://manipurhealthdirectorate.in/' },
    { name: 'Meghalaya', type: 'STATE', authorityName: 'North Easternigira Gandhi Regional Institute of Health & Medical Sciences (NEIGRIHMS)', primaryWebsite: 'http://neigrihms.gov.in/' },
    { name: 'Mizoram', type: 'STATE', authorityName: 'Department of Higher & Technical Education Mizoram', primaryWebsite: 'https://dhte.mizoram.gov.in/' },
    { name: 'Nagaland', type: 'STATE', authorityName: 'Directorate of Technical Education Nagaland', primaryWebsite: 'https://dte.nagaland.gov.in/' },
    { name: 'Odisha', type: 'STATE', authorityName: 'Odisha Joint Entrance Examination (OJEE)', primaryWebsite: 'https://ojee.nic.in/' },
    { name: 'Puducherry', type: 'UT', authorityName: 'Centralised Admission Committee (CENTAC)', primaryWebsite: 'https://centacpuducherry.in/' },
    { name: 'Punjab', type: 'STATE', authorityName: 'Baba Farid University of Health Sciences (BFUHS)', primaryWebsite: 'https://bfuhs.ac.in/' },
    { name: 'Rajasthan', type: 'STATE', authorityName: 'State Medical & Dental Counselling Board', primaryWebsite: 'https://rajugneet2026.com/' },
    { name: 'Sikkim', type: 'STATE', authorityName: 'Directorate of Technical Education Sikkim', primaryWebsite: 'https://sikkimhrdd.org/' },
    { name: 'Tamil Nadu', type: 'STATE', authorityName: 'Directorate of Medical Education (DME) Tamil Nadu', primaryWebsite: 'https://tnmedicalselection.net/' },
    { name: 'Telangana', type: 'STATE', authorityName: 'Kaloji Narayana Rao University of Health Sciences (KNRUHS)', primaryWebsite: 'https://knruhs.telangana.gov.in/' },
    { name: 'Tripura', type: 'STATE', authorityName: 'Directorate of Medical Education (DME) Tripura', primaryWebsite: 'https://dme.tripura.gov.in/' },
    { name: 'Uttar Pradesh', type: 'STATE', authorityName: 'Directorate General of Medical Education and Training (UP DGME)', primaryWebsite: 'https://upneet.gov.in/' },
    { name: 'Uttarakhand', type: 'STATE', authorityName: 'Hemwati Nandan Bahuguna Uttarakhand Medical Education University (HNBUMU)', primaryWebsite: 'http://hnbumu.ac.in/' },
    { name: 'West Bengal', type: 'STATE', authorityName: 'West Bengal Medical Counselling Committee (WBMCC)', primaryWebsite: 'https://wbmcc.nic.in/' },
];

async function main() {
    console.log('🌱 Seeding NEET UG Database with Master Registry...');

    for (const item of MASTER_REGISTRY) {
        // Upsert State
        const state = await prisma.state.upsert({
            where: { name: item.name },
            update: {},
            create: {
                name: item.name,
                type: item.type
            }
        });

        console.log(`- Inserted State: ${state.name}`);

        // Upsert Counselling Authority
        const authorityList = await prisma.counsellingAuthority.findMany({ where: { stateId: state.id, name: item.authorityName } });
        let authority = authorityList[0];
        if (!authority) {
            authority = await prisma.counsellingAuthority.create({
                data: {
                    stateId: state.id,
                    name: item.authorityName,
                    primaryWebsite: item.primaryWebsite
                }
            });
        }

        // Initialize 2026 Counselling Cycle if it doesn't exist
        const existingCycle = await prisma.counsellingCycle.findUnique({
            where: { authorityId_year: { authorityId: authority.id, year: 2026 } }
        });

        if (!existingCycle) {
            await prisma.counsellingCycle.create({
                data: {
                    authorityId: authority.id,
                    year: 2026,
                    currentStatus: 'NOT_ANNOUNCED',
                    statusValidation: 'UNKNOWN'
                }
            });
        }
    }

    console.log('✅ Database seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
