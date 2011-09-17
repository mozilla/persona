Vagrant::Config.run do |config|

    config.vm.box = "lucid32_2.box"
    config.vm.box_url = "http://people.mozilla.org/~aking/browserid/lucid32_2.box"

    #                      name      vagrant  desktop
    config.vm.forward_port("readme",   10000, 10000)
    config.vm.forward_port("verifier", 10001, 10001)
    config.vm.forward_port("server",   10002, 10002)



    # Increase vagrant's patience during hang-y CentOS bootup
    # see: https://github.com/jedi4ever/veewee/issues/14
    config.ssh.max_tries = 50
    config.ssh.timeout   = 300

    # nfs needs to be explicitly enabled to run.

    config.vm.share_folder("v-root", "/home/vagrant/browserid", ".")

    # Add to /etc/hosts: 33.33.33.27 dev.browserid.org
    config.vm.network "33.33.33.27"

end
