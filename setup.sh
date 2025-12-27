#!/bin/bash


# Check current directory
if [ ! -f "docker/frontend/index.html" ] || [ ! -f "docker/backend/app.py" ]; then
    echo "File(s) missing..."
    echo "Sorry, you must be in the pika directory, extracted from the release zip file, downloaded from the github page."
    exit 1
fi


# Prompt if user is here to reset password
if [ "$(docker ps -aq -f name=pika)" ]; then
  echo ""
  read -r -p "Are you here for resetting admin password (yes/no): " confirm
  if [ "$confirm" == "yes" ]; then
    echo "1" > docker/backend/is_reset_password.txt
    echo -e "Password reset!\n"
    echo -e "Restarting the service, please wait patiently...\n"
    docker restart pika-nginx
    docker restart pika-python
    echo -e "Exiting...\n"
    exit 0
  fi
fi


# Check if docker is installed
if ! command -v docker &> /dev/null
then
    echo -e "\nDocker not found on your system, or it just simply lacks the sudo power."
    exit 1
fi


# Check if existing service is already installed on docker
if [ "$(docker ps -aq -f name=pika)" ]; then
    echo ""
    read -r -p "There is an existing one, do you want to reinstall and reconfigure it? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
        echo -e "\nStopping, please wait patiently..."
        docker stop pika-nginx
        docker stop pika-python
        docker rm pika-nginx
        docker rm pika-python
    else
        echo -e "Exiting...\n"
        exit 1
    fi
fi


# Check if docker compose is installed
if ! command -v docker compose &> /dev/null
then
    echo -e "\nDocker compose not found on your system."
    echo "Please install docker compose, not docker-compose."
    exit 1
fi


# Check if openssl is installed
if ! command -v openssl &> /dev/null
then
    echo -e "\nOpenSSL not found on your system."
    echo "Please install OpenSSL."
    exit 1
fi


# Generate .env and set baseurl and link it to docker/web/.env and docker/backend/.env
echo -e "\nPlease enter the base URL that is used to show on the webpage of the generated link (including https:// or http:// and the port number behind if not 80 or 443)."
echo -e "If you are routing this through a proxy, you should enter the proxied information.\n"
echo -e "Please note that the default port of is 8887, if you are using a different port, you should change it in the docker-compose.yml file.\n"
read -r -p "Please enter: " baseurl

# They should be the same, except when developing
echo "web_hostname: \"$baseurl\"" > docker/frontend/conf.yaml
echo "api_hostname: \"$baseurl\"" >> docker/frontend/conf.yaml


echo -e "\nPlease enter the exposed port of the nginx container (should be the same port as the last one except you have you own proxy)"
read -r -p "Please enter: " exposed_port
echo "WEB_EXPOSED_PORT= $exposed_port" >> .env


# Remove old database
rm -f docker/backend/data.db


# Generate is_reset_password.txt
echo "0" > docker/backend/is_reset_password.txt


# Generate ALLOWED_ORIGINS
echo "ALLOWED_ORIGINS=$baseurl" >> docker/backend/.env


# Generate SECRET_KEY
echo "SECRET_KEY=$(openssl rand -hex 64)" >> docker/backend/.env


# Generate bearer_token
TOKEN=$(openssl rand -hex 16)
echo "BEARER_TOKEN=$TOKEN" >> docker/backend/.env


# Copy dictionary
cp -r dictionary.txt docker/backend/


# Set permission
chmod -R 777 docker


# Docker compose up
docker compose up --build -d


# Finished message
echo -e "\nInstallation finished!"
