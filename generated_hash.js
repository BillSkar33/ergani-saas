const bcrypt = require('bcryptjs');
const password = '12345678';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
const result = bcrypt.compareSync(password, hash);
console.log('Match:', result);
