#!/usr/bin/env bash
# ==============================================================================
# Lab 8 — Kubernetes Cluster Helper Script (Minikube / Kind / Docker)
# ==============================================================================
# Helper to install kubectl & minikube/kind if not present, start the cluster,
# and build/load the container images into the cluster.
# ==============================================================================

set -euo pipefail

echo "=============================================================================="
echo "🚀 Lab 8 — Cluster Setup & Image Builder"
echo "=============================================================================="

# 1. Check or install kubectl
if ! command -v kubectl &>/dev/null; then
  echo "Installing kubectl into ~/.local/bin..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/kubectl" "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x "$HOME/.local/bin/kubectl"
  export PATH="$HOME/.local/bin:$PATH"
  echo "✔ kubectl installed: $(kubectl version --client --output=yaml | grep gitVersion || true)"
else
  echo "✔ kubectl found: $(which kubectl)"
fi

# 2. Check Minikube / Kind
if ! command -v minikube &>/dev/null && ! command -v kind &>/dev/null; then
  echo "Neither minikube nor kind found. Installing minikube into ~/.local/bin..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/minikube" "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64"
  chmod +x "$HOME/.local/bin/minikube"
  export PATH="$HOME/.local/bin:$PATH"
  echo "✔ minikube installed."
fi

# 3. Build Docker images for all 4 microservices
echo -e "\n📦 Building Docker images..."
docker build -t campusconnect-api-gateway:latest ./api-gateway
docker build -t campusconnect-user-service:latest ./user-service
docker build -t campusconnect-product-service:latest ./product-service
docker build -t campusconnect-order-service:latest ./order-service

# 4. If using Minikube or Kind, load images into the cluster
if command -v minikube &>/dev/null && minikube status &>/dev/null; then
  echo -e "\n📥 Loading images into Minikube cluster..."
  minikube image load campusconnect-api-gateway:latest
  minikube image load campusconnect-user-service:latest
  minikube image load campusconnect-product-service:latest
  minikube image load campusconnect-order-service:latest
elif command -v kind &>/dev/null; then
  echo -e "\n📥 Loading images into Kind cluster..."
  kind load docker-image campusconnect-api-gateway:latest || true
  kind load docker-image campusconnect-user-service:latest || true
  kind load docker-image campusconnect-product-service:latest || true
  kind load docker-image campusconnect-order-service:latest || true
fi

# 5. Apply manifests
echo -e "\n☸️ Applying Kubernetes manifests to namespace 'lab8'..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/ -n lab8

echo -e "\n✅ Cluster manifests applied!"
echo "Check pods with: kubectl get pods -n lab8"
