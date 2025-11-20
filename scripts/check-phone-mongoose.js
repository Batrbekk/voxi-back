const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_db_user:rCeekL8z3gybzD9K@voxi.nblzcdt.mongodb.net/voxi?retryWrites=true&w=majority';

async function checkPhoneAssignment() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas\n');

    // Define schemas
    const PhoneSchema = new mongoose.Schema({}, { strict: false, collection: 'phonenumbers' });
    const AgentSchema = new mongoose.Schema({}, { strict: false, collection: 'agents' });

    const Phone = mongoose.model('Phone', PhoneSchema);
    const Agent = mongoose.model('Agent', AgentSchema);

    // Find the phone number
    console.log('📞 Searching for phone number +77719444951...\n');
    const phone = await Phone.findOne({ phoneNumber: '+77719444951' }).lean();

    if (phone) {
      console.log('=' .repeat(60));
      console.log('📞 PHONE NUMBER DATA:');
      console.log('=' .repeat(60));
      console.log('Number:', phone.phoneNumber);
      console.log('Label:', phone.label);
      console.log('Status:', phone.status);
      console.log('Provider:', phone.provider);
      console.log('Is Active:', phone.isActive);
      console.log('Company ID:', phone.companyId);
      console.log('Assigned Agent ID:', phone.assignedAgentId ? phone.assignedAgentId.toString() : 'NOT ASSIGNED');
      console.log('Created At:', phone.createdAt);
      console.log('Updated At:', phone.updatedAt);

      // If agent is assigned, get agent details
      if (phone.assignedAgentId) {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 ASSIGNED AGENT DATA:');
        console.log('='.repeat(60));

        const agent = await Agent.findById(phone.assignedAgentId).lean();

        if (agent) {
          console.log('✅ Agent found!');
          console.log('   ID:', agent._id.toString());
          console.log('   Name:', agent.name);
          console.log('   Description:', agent.description || 'N/A');
          console.log('   Is Active:', agent.isActive);
          console.log('   Company ID:', agent.companyId.toString());
          console.log('   Voice Settings:', JSON.stringify(agent.voiceSettings, null, 2));
          console.log('   Inbound Greeting:', agent.inboundGreetingMessage || 'Not set');
          console.log('   Outbound Greeting:', agent.outboundGreetingMessage || 'Not set');
          console.log('   Created At:', agent.createdAt);

          // Check if IDs match
          console.log('\n' + '='.repeat(60));
          console.log('🔍 VALIDATION:');
          console.log('='.repeat(60));

          const phoneCompanyId = phone.companyId.toString();
          const agentCompanyId = agent.companyId.toString();
          const assignedAgentId = phone.assignedAgentId.toString();
          const actualAgentId = agent._id.toString();

          if (assignedAgentId === actualAgentId) {
            console.log('✅ Agent ID matches correctly');
          } else {
            console.log('❌ Agent ID mismatch!');
            console.log('   Expected:', actualAgentId);
            console.log('   Got:', assignedAgentId);
          }

          if (phoneCompanyId === agentCompanyId) {
            console.log('✅ Company IDs match correctly');
          } else {
            console.log('⚠️  Company ID mismatch!');
            console.log('   Phone Company:', phoneCompanyId);
            console.log('   Agent Company:', agentCompanyId);
          }

          console.log('\n✅ Everything is correctly assigned!');

        } else {
          console.log('❌ Agent not found with ID:', phone.assignedAgentId.toString());
          console.log('⚠️  This is a DATA INTEGRITY issue!');
        }
      } else {
        console.log('\nℹ️  No agent assigned to this phone number');
      }

      console.log('\n' + '='.repeat(60));

    } else {
      console.log('❌ Phone number +77719444951 not found in database');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkPhoneAssignment();
