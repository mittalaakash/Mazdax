#!/bin/bash
set -e

curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
npm install -g pm2

su - ubuntu -c '
  git clone https://github.com/mittalaakash/Mazdax.git ~/Mazdax
  cd ~/Mazdax/server
  npm install
  PORT=5050 pm2 start index.js --name mazdax-server
  pm2 save
'

env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
