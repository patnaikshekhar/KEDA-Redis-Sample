
Lets start by creating a new namespace and installing redis in cluster. 

```sh
# Create Namespace
kubectl create ns keda-redis-test

# Install Redis using Helm
helm install stable/redis --name=redis --namespace keda-redis-test
```

The helm chart (by default) creates two services redis-master and redis-slave. It also creates a secret to store the redis password, called redis. We will be referring to that in our deployment.




