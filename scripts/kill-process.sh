#!/bin/bash

# @see https://stackoverflow.com/questions/11583562/how-to-kill-a-process-running-on-particular-port-in-linux

PORT=${1:-8080}
# Find the process ID (PID) of the process running on port 8080
PID=$(lsof -t -i:$PORT)

# Check if a PID was found
if [ -n "$PID" ]; then
  # Kill the process
  # kill -9 $PID
  echo "Process running on port 8080 has been killed."
else
  echo "No process found running on port 8080."
fi