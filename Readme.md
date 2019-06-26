# KEDA Redis Example

This is an example of using [KEDA](https://github.com/kedacore/keda) with Redis and Node

KEDA (Kubernetes-based Event Driven Autoscaling) allows you to auto scale your kubernetes pods based on external metrics derived from systems such as Redis, RabbitMQ, AWS SQS, Azure Storage Queues, Azure ServiceBus, etc. It also lets your scale the number of pods to zero so that you're not consuming resources when there is no processing to be done.

# Prerequisites
You need a Kubernetes cluster with KEDA installed. The [KEDA git hub repository](https://github.com/kedacore/keda) explains how this can be done using Helm.

You will also need to make sure that you are using the image tag: master
```sh
helm upgrade keda kedacore/keda-edge \
  --devel \
  --set logLevel=debug \
  --set image.tag=master \
  --namespace keda
```

# Tutorial

Lets start by creating a new namespace and installing redis in cluster. 

```sh
# Create Namespace
kubectl create ns keda-redis-test

# Install Redis using Helm
helm install stable/redis --name=redis --namespace keda-redis-test
```

The helm chart (by default) creates two services redis-master and redis-slave. It also creates a secret to store the redis password, called redis. We will be referring to that in our deployment.

This is what the deployment looks like:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keda-redis-node
  namespace: keda-redis-test
spec:
  selector:
    matchLabels:
      service: keda-redis-node
  replicas: 1
  template:
    metadata:
      labels:
        service: keda-redis-node
    spec:
      containers:
      - image: patnaikshekhar/keda-redis-node:1
        name: consumer
        env:
        - name: REDIS_HOST
          value: redis-master.keda-redis-test.svc.cluster.local:6379
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis
              key: redis-password
        - name: LIST_NAME
          value: mylist
```

As you can see the deployment sets the REDIS_HOST environment variable to the pod to point to the redis-master service. It also sets the REDIS_PASSWORD variable from the secret deployment by the helm chart.

We will also need a Scaled Object yaml which will describe how you want your app to be scaled. The Scaled Object yaml looks like the following:

```yaml
apiVersion: keda.k8s.io/v1alpha1
kind: ScaledObject
metadata:
  name: redis-scaledobject
  namespace: keda-redis-test
  labels:
    deploymentName: keda-redis-node
spec:
  scaleTargetRef:
    deploymentName: keda-redis-node
  triggers:
  - type: redis
    metadata:
      address: REDIS_HOST # Required host:port format
      password: REDIS_PASSWORD
      listName: mylist # Required
      listLength: "5" # Required
```

As you can see the scaled object contains the name of the environment variables that contain the host name (address) and password. It also contains the name of the list that you want to monitor. The KEDA Redis scaler performs a LLEN of the list that you mention and compares that with the list length (listLength) parameter in the yaml.

We can now deploy the manifests

```sh
kubectl apply -f manifests/
```

We can now open a terminal window to start monitoring the pods. You should see no pods started at this point.

```sh
kubectl get pods -n keda-redis-test -w
```

Now we're ready to see that KEDA starts up new pods when items are added to the list. We're first going to deploy a pod with the redis cli in a new terminal window.

```sh
# Get the password for the redis instance
export REDIS_PASSWORD=$(kubectl get secret --namespace keda-redis-test redis -o jsonpath="{.data.redis-password}" | base64 --decode)

# Create a pod with the Redis CLI
kubectl run --namespace keda-redis-test redis-client --rm --tty -i --restart='Never' \
    --env REDIS_PASSWORD=$REDIS_PASSWORD \
    --image docker.io/bitnami/redis:5.0.5-debian-9-r36 -- bash

# Once in the pod. Lets run the Redis CLI connecting to the master
redis-cli -h redis-master -a $REDIS_PASSWORD
```

Now that we're in the redis REPL / prompt we can add messages to the list. Type the following command to add messages to the list

```sh
redis-master:6379> LPUSH mylist message1 message2 message3 message4 message5 message6
```

You should see a new POD spinning up in the previous terminal window where you're watching the number of running pods. KEDA spins up a new POD when it sees that an item has been added to the list in redis. If you wait a while you will see that once the pod has finishing processing the messages in the list it would then be terminated by KEDA.


