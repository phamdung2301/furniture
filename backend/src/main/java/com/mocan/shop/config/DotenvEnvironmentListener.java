package com.mocan.shop.config;
import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvEntry;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
public class DotenvEnvironmentListener implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    private static final Logger log = LoggerFactory.getLogger(DotenvEnvironmentListener.class);

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        ConfigurableEnvironment environment = event.getEnvironment();
        Dotenv dotenv = Dotenv.configure()
                .directory("./")
                .filename(".env")
                .ignoreIfMissing()
                .load();

        Map<String, Object> vars = new HashMap<>();
        for (DotenvEntry entry : dotenv.entries()) {
            vars.put(entry.getKey(), entry.getValue());
        }
        if (vars.isEmpty()) {
            return;
        }

        environment.getPropertySources().addLast(new MapPropertySource("dotenv", vars));
        log.info("Da nap {} bien tu file .env", vars.size());
    }
}
